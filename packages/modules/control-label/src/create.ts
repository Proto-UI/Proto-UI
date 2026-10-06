import {
  isControlLabelRef,
  type ControlLabelFacade,
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
  constructor(
    caps: ModuleFactoryArgs['caps'],
    private readonly a11y: A11yPort,
    private readonly prototypeName: string
  ) {
    super(caps);
  }
  readonly facade: ControlLabelFacade = {
    label: () => this.declare('label'),
    target: (activate) => this.declare('target', activate as typeof this.activate),
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
    activate: typeof this.activate = null
  ): ControlLabelHandle {
    this.sys.ensureSetup('controlLabel.declare');
    if (this.kind) throw new Error('[ControlLabel] one subject or target declaration per instance');
    this.kind = kind;
    this.activate = activate;
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
  }
  private setDiagnostic(code: string | null): void {
    if (code === this.diagnostic) return;
    this.diagnostic = code;
    // A temporarily absent sibling during ordinary mounting is observable in
    // the port, not a warning on every valid pair's construction/teardown.
    if (code && code !== 'missing-binding')
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
  create: createControlLabelModule,
});
