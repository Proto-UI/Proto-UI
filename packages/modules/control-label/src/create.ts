import {
  isControlLabelRef,
  type ControlLabelFacade,
  type ControlLabelAnatomyPair,
  type ControlLabelHandle,
  type ControlLabelOptions,
  type ControlLabelRef,
  type ControlLabelRequest,
  type MountPhase,
  type RunHandle,
  type ModulePort,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import {
  createModule,
  defineModule,
  ModuleBase,
  type ModuleFactoryArgs,
} from '@proto.ui/module-base';
import type { A11yPort } from '@proto.ui/module-a11y';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { acquireAnatomyControlLabelPair, validateAnatomyControlLabelPair } from './anatomy-pair';
import {
  CONTROL_LABEL_HOST_CAP,
  CONTROL_LABEL_RUN_IN_CALLBACK_CAP,
  type ControlLabelHostLease,
} from './caps';
import { bindControlLabel } from './registry';
export type ControlLabelPort = ModulePort & {
  prepareViewPresence(present: boolean): void;
  getDiagnostic(): string | null;
  setReference(ref: ControlLabelRef | null | undefined): void;
};

class ControlLabelModuleImpl extends ModuleBase {
  private readonly owner = {};
  private kind: 'label' | 'target' | null = null;
  private ref: ControlLabelRef | null = null;
  private options: ControlLabelOptions = { naming: true, activation: false };
  private activate: ((run: RunHandle<PropsBaseType>, request: ControlLabelRequest) => void) | null =
    null;
  private host: ControlLabelHostLease | null = null;
  private binding: ReturnType<typeof bindControlLabel> | null = null;
  private present = true;
  private disposed = false;
  private generation = 0;
  private diagnostic: string | null = null;
  private anatomyPair: ControlLabelAnatomyPair | null = null;
  private anatomyScope: unknown = null;
  private anatomyLease: ReturnType<typeof acquireAnatomyControlLabelPair> | null = null;
  private anatomyOffs: Array<() => void> = [];

  constructor(
    caps: ModuleFactoryArgs['caps'],
    private readonly a11y: A11yPort,
    private readonly anatomy: AnatomyPort | undefined,
    private readonly prototypeName: string
  ) {
    super(caps);
  }
  readonly facade: ControlLabelFacade = {
    label: (pair) => this.declare('label', null, pair),
    target: (activate, pair) => this.declare('target', activate as typeof this.activate, pair),
  };
  readonly port: ControlLabelPort = {
    prepareViewPresence: (present) => {
      if (this.present === present) return;
      this.present = present;
      this.refresh();
    },
    getDiagnostic: () => this.diagnostic,
    setReference: (ref) => {
      this.sys.ensureNotDisposed('controlLabel.setReference');
      if (this.anatomyPair) {
        if (ref != null)
          throw new Error(
            '[ControlLabel] explicit and anatomy association modes are mutually exclusive'
          );
        return;
      }
      if (ref != null && !isControlLabelRef(ref))
        throw new TypeError('[ControlLabel] invalid opaque association reference');
      if (ref != null && !this.kind)
        throw new Error(
          '[ControlLabel] this Prototype has not declared Label or target participation'
        );
      if (this.ref === (ref ?? null)) return;
      const retiredGeneration = this.release();
      if (this.disposed || retiredGeneration !== this.generation) return;
      this.ref = ref ?? null;
      this.refresh();
    },
  };
  private declare(
    kind: 'label' | 'target',
    activate: typeof this.activate = null,
    pair?: ControlLabelAnatomyPair
  ): ControlLabelHandle {
    this.sys.ensureSetup('controlLabel.declare');
    if (this.kind) throw new Error('[ControlLabel] one subject or target declaration per instance');
    if (pair) validateAnatomyControlLabelPair(pair);
    this.kind = kind;
    this.activate = activate;
    this.anatomyPair = pair ? Object.freeze({ ...pair }) : null;
    if (pair && this.anatomy) {
      this.anatomyOffs.push(
        this.anatomy.subscribeOrder(pair.family, () => this.refresh()),
        this.anatomy.subscribeTargets(pair.family, () => this.refresh())
      );
    }
    return {
      sync: (options) => {
        this.sys.ensureNotDisposed('controlLabel.sync');
        if (typeof options.naming !== 'boolean' || typeof options.activation !== 'boolean')
          throw new TypeError('[ControlLabel] naming and activation require explicit booleans');
        if (
          this.options.naming === options.naming &&
          this.options.activation === options.activation
        )
          return;
        this.options = { ...options };
        this.host?.setActivation(this.kind === 'label' && options.activation);
        this.binding?.refresh();
      },
    };
  }
  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    this.refresh();
  }
  override onCapsEpoch(): void {
    this.release();
    this.refresh();
  }
  afterRenderCommit(): void {
    this.refresh();
    this.binding?.refresh();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    this.ref = null;
    this.activate = null;
    for (const off of this.anatomyOffs.splice(0)) off();
    this.anatomyLease?.dispose();
    this.anatomyLease = null;
    this.anatomyScope = null;
  }
  private setDiagnostic(code: string | null): void {
    if (code === this.diagnostic) return;
    this.diagnostic = code;
    // A temporarily absent sibling during ordinary mounting is observable in
    // the port, not a warning on every valid pair's construction/teardown.
    if (code && code !== 'missing-binding' && code !== 'missing-anatomy-domain')
      console.warn(`[ControlLabel] ${this.prototypeName}: ${code}`);
  }
  private release(): number {
    const retiredGeneration = ++this.generation;
    const binding = this.binding;
    const host = this.host;
    // Clear both owned slots before any disposer can install a newer lease.
    this.binding = null;
    this.host = null;
    try {
      binding?.dispose();
    } finally {
      host?.dispose();
    }
    return retiredGeneration;
  }
  private refresh(): void {
    if (this.anatomyPair && !this.disposed) {
      const pair = this.anatomyPair;
      const expectedRole = this.kind === 'label' ? pair.labelRole : pair.targetRole;
      const scope =
        this.anatomy?.resolveSelfRole(pair.family) === expectedRole
          ? this.anatomy.resolveDomainScope(pair.family)
          : null;
      if (scope !== this.anatomyScope || (scope && !this.anatomyLease)) {
        const generation = this.release();
        if (this.disposed || generation !== this.generation) return;
        this.anatomyLease?.dispose();
        this.anatomyLease = null;
        this.ref = null;
        this.anatomyScope = scope;
        if (scope) {
          this.anatomyLease = acquireAnatomyControlLabelPair(pair, scope);
          this.ref = this.anatomyLease.ref;
        }
      }
      if (!scope)
        this.setDiagnostic(this.anatomy ? 'missing-anatomy-domain' : 'unsupported-anatomy');
    }
    if (
      this.disposed ||
      !this.kind ||
      !this.ref ||
      !this.present ||
      this.mountPhase === 'detached' ||
      this.mountPhase === 'unmounting'
    ) {
      if (this.binding || this.host) this.release();
      return;
    }
    if (this.binding) {
      this.binding.refresh();
      return;
    }
    if (!this.caps.has(CONTROL_LABEL_HOST_CAP)) {
      this.setDiagnostic('unsupported-host');
      return;
    }
    const generation = ++this.generation;
    try {
      const host = this.caps.get(CONTROL_LABEL_HOST_CAP).attach({
        kind: this.kind,
        activation: this.kind === 'label' && this.options.activation,
        onActivate: (source) => {
          if (generation === this.generation && !this.disposed)
            this.binding?.requestActivation(source);
        },
        onViewChange: () => {
          if (generation === this.generation && !this.disposed) this.binding?.refresh();
        },
      });
      if (generation !== this.generation || this.disposed) {
        host.dispose();
        return;
      }
      this.host = host;
      const binding = bindControlLabel({
        owner: this.owner,
        kind: this.kind,
        ref: this.ref,
        semanticRef: this.a11y.getObjectRef(),
        view: () =>
          generation === this.generation && this.present && !this.disposed ? host.view() : null,
        options: () => this.options,
        name: (label) => this.a11y.claimControlLabelName(label),
        activate: (isCurrent, source) => {
          if (!isCurrent() || !this.activate) return;
          if (!this.caps.has(CONTROL_LABEL_RUN_IN_CALLBACK_CAP)) {
            this.setDiagnostic('unsupported-callback-scope');
            return;
          }
          this.caps.get(CONTROL_LABEL_RUN_IN_CALLBACK_CAP)(() => {
            if (!isCurrent() || generation !== this.generation || !this.activate) return;
            const run = this.sys.getCallbackCtx() as RunHandle<PropsBaseType> | undefined;
            if (!run) throw new Error('[ControlLabel] host failed to enter target callback scope');
            this.activate(run, { isCurrent, source });
          });
        },
        diagnostic: (code) => this.setDiagnostic(code),
      });
      if (generation !== this.generation || this.disposed) binding.dispose();
      else this.binding = binding;
    } catch (error) {
      // Acquisition may have installed a host before naming failed. Withdraw
      // only this attempt, and clear intent before cleanup can install a newer
      // association. A failed reference is then eligible for an explicit retry.
      if (generation === this.generation && !this.disposed) {
        if (!this.anatomyPair) this.ref = null;
        try {
          this.release();
        } catch {
          // Preserve the acquisition error, even if its cleanup also failed.
        }
      }
      throw error;
    }
  }
}
export function createControlLabelModule(ctx: ModuleFactoryArgs) {
  return createModule<'control-label', 'instance', ControlLabelFacade, ControlLabelPort>({
    name: 'control-label',
    scope: 'instance',
    ...ctx,
    build: ({ caps, deps, init }) => {
      const impl = new ControlLabelModuleImpl(
        caps,
        deps.requirePort<A11yPort>('a11y'),
        deps.tryPort<AnatomyPort>('anatomy'),
        init.prototypeName
      );
      return {
        facade: impl.facade,
        port: impl.port,
        hooks: {
          onMountPhase: (phase, epoch) => impl.onMountPhase(phase, epoch),
          afterRenderCommit: () => impl.afterRenderCommit(),
          dispose: () => impl.dispose(),
        },
      };
    },
  });
}
export const ControlLabelModuleDef = defineModule({
  name: 'control-label',
  resourceOwnership: 'mixed',
  deps: ['a11y'],
  optionalDeps: ['anatomy'],
  create: createControlLabelModule,
});
