import type {
  AnatomyPartView,
  AxisInputBinding,
  AxisInputCancelReason,
  AxisInputConfig,
  AxisInputHandle,
  AxisInputHost,
  AxisInputHostLease,
  AxisInputSample,
  MountPhase,
  RunHandle,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import {
  createModule,
  defineModule,
  ModuleBase,
  type ModuleFactoryArgs,
} from '@proto.ui/module-base';
import { AXIS_INPUT_HOST_CAP, AXIS_INPUT_RUN_IN_CALLBACK_CAP } from './caps';

const INITIAL_CONFIG: AxisInputConfig = Object.freeze({
  axis: 'horizontal',
  direction: 'ltr',
  disabled: true,
  readOnly: false,
  reverse: false,
  contactBasis: 'preserve-start',
  activation: 'immediate',
});
type Listener = (run: RunHandle<PropsBaseType>, sample: AxisInputSample) => void;
type Targets = {
  input: unknown;
  geometry: unknown;
  travel?: unknown;
  deltaBasis?: readonly unknown[];
  ownership?: {
    domain: unknown;
    input: unknown;
    geometry: unknown;
    travel?: unknown;
    parts: readonly AnatomyPartView[];
  };
};

class AxisInputModuleImpl extends ModuleBase {
  private declared = false;
  private binding: AxisInputBinding | null = null;
  private config = INITIAL_CONFIG;
  private listeners: Listener[] = [];
  private subscriptions: (() => void)[] = [];
  private lease: AxisInputHostLease | null = null;
  private host: AxisInputHost | null = null;
  private targets: Targets | null = null;
  private epoch = 0;
  private active = false;
  private deliveryEpoch = 0;
  private disposed = false;

  constructor(
    caps: ModuleFactoryArgs['caps'],
    private anatomy: AnatomyPort
  ) {
    super(caps);
  }

  declare(): AxisInputHandle {
    this.sys.ensureSetup('axisInput.declare');
    if (this.declared) throw new Error('[AxisInput] One input may be declared per instance.');
    this.declared = true;
    return {
      configure: (binding) => {
        this.sys.ensureSetup('axisInput.configure');
        if (this.binding) throw new Error('[AxisInput] Input anatomy may be configured only once.');
        if (
          !binding.anatomy.decl.roles[binding.inputRole] ||
          !binding.anatomy.decl.roles[binding.geometryRole] ||
          (binding.travelRole !== undefined && !binding.anatomy.decl.roles[binding.travelRole]) ||
          (binding.deltaBasisRole !== undefined &&
            !binding.anatomy.decl.roles[binding.deltaBasisRole])
        ) {
          throw new Error(
            '[AxisInput] Input and geometry roles must belong to the anatomy family.'
          );
        }
        this.binding = Object.freeze({ ...binding });
        const refresh = () => this.refresh();
        this.subscriptions.push(this.anatomy.subscribeOrder(binding.anatomy, refresh));
        this.subscriptions.push(this.anatomy.subscribeTargets(binding.anatomy, refresh));
      },
      on: (listener) => {
        this.sys.ensureSetup('axisInput.on');
        this.listeners.push(listener);
      },
      sync: (patch) => {
        this.sys.ensureCallback('axisInput.sync');
        if (
          patch.activation !== undefined &&
          patch.activation !== 'immediate' &&
          patch.activation !== 'directional'
        )
          throw new TypeError('[AxisInput] Invalid activation policy.');
        if (
          patch.contactBasis !== undefined &&
          patch.contactBasis !== 'preserve-start' &&
          patch.contactBasis !== 'cancel-on-extent-change'
        ) {
          throw new TypeError('[AxisInput] Invalid contactBasis policy.');
        }
        const next: AxisInputConfig = Object.freeze({
          axis: patch.axis ?? this.config.axis,
          direction: patch.direction ?? this.config.direction,
          disabled: patch.disabled ?? this.config.disabled,
          readOnly: patch.readOnly ?? this.config.readOnly,
          reverse: patch.reverse ?? this.config.reverse,
          contactBasis: patch.contactBasis ?? this.config.contactBasis,
          activation: patch.activation ?? this.config.activation,
        });
        if (
          Object.keys(INITIAL_CONFIG).every(
            (key) =>
              next[key as keyof AxisInputConfig] === this.config[key as keyof AxisInputConfig]
          )
        )
          return;
        this.config = next;
        this.refresh();
      },
    };
  }

  private resolveTargets(): Targets | null {
    const binding = this.binding;
    if (!binding || this.anatomy.resolveSelfRole(binding.anatomy) !== binding.inputRole)
      return null;
    const self = this.anatomy.resolveSelfInstance();
    const parts = this.anatomy.order.partsOf(binding.anatomy, binding.inputRole, {
      missing: 'empty',
    });
    const input = parts.find((part) => this.anatomy.resolvePartInstance(part) === self);
    if (!input) return null;
    const geometryInstance =
      binding.geometryRole === binding.inputRole
        ? self
        : this.anatomy.resolveAncestorInstance(binding.anatomy, input, binding.geometryRole);
    if (geometryInstance === null) return null;
    const geometry =
      binding.geometryRole === binding.inputRole
        ? input
        : this.anatomy.order
            .partsOf(binding.anatomy, binding.geometryRole, { missing: 'empty' })
            .find((part) => this.anatomy.resolvePartInstance(part) === geometryInstance);
    if (!geometry) return null;
    const inputTarget = this.anatomy.resolvePartTarget(input);
    const geometryTarget = this.anatomy.resolvePartTarget(geometry);
    if (!inputTarget || !geometryTarget) return null;
    let travelPart: AnatomyPartView | undefined;
    if (binding.travelRole !== undefined) {
      const travelParts = this.anatomy.order
        .partsOf(binding.anatomy, binding.travelRole, {
          missing: 'empty',
        })
        .filter(
          (part) =>
            this.anatomy.resolveAncestorInstance(binding.anatomy, part, binding.geometryRole) ===
            geometryInstance
        );
      if (travelParts.length !== 1) return null;
      travelPart = travelParts[0];
    }
    const travel = travelPart ? this.anatomy.resolvePartTarget(travelPart) : undefined;
    if (travelPart && !travel) return null;
    const basisParts =
      binding.deltaBasisRole === undefined
        ? undefined
        : this.anatomy.order
            .partsOf(binding.anatomy, binding.deltaBasisRole, { missing: 'empty' })
            .filter(
              (part) =>
                this.anatomy.resolveAncestorInstance(
                  binding.anatomy,
                  part,
                  binding.geometryRole
                ) === geometryInstance
            );
    const deltaBasis = basisParts?.map((part) => this.anatomy.resolvePartTarget(part));
    if (deltaBasis && (deltaBasis.length === 0 || deltaBasis.some((target) => !target)))
      return null;
    const targets: Targets = { input: inputTarget, geometry: geometryTarget, travel, deltaBasis };
    if (
      this.config.activation === 'directional' ||
      binding.travelRole !== undefined ||
      binding.deltaBasisRole !== undefined
    ) {
      const domain = this.anatomy.resolveDomainScope(binding.anatomy);
      if (domain === null) return null;
      targets.ownership = {
        domain,
        input: self,
        geometry: geometryInstance,
        travel: travelPart ? this.anatomy.resolvePartInstance(travelPart) : undefined,
        parts: [input, geometry, ...(travelPart ? [travelPart] : []), ...(basisParts ?? [])],
      };
    }
    return targets;
  }

  private sameTargets(next: Targets | null): boolean {
    if (
      !next ||
      !this.targets ||
      next.input !== this.targets.input ||
      next.geometry !== this.targets.geometry ||
      next.travel !== this.targets.travel ||
      (next.deltaBasis?.length ?? 0) !== (this.targets.deltaBasis?.length ?? 0) ||
      (next.deltaBasis?.some((target, i) => target !== this.targets!.deltaBasis?.[i]) ?? false)
    )
      return false;
    return this.sameOwnership(next);
  }

  private sameOwnership(next: Targets | null): boolean {
    const old = this.targets?.ownership;
    const current = next?.ownership;
    if (!old || !current) return old === current;
    return (
      old.domain === current.domain &&
      old.input === current.input &&
      old.geometry === current.geometry &&
      old.travel === current.travel &&
      old.parts.every((part) => this.anatomy.isCurrentPart(this.binding!.anatomy, part))
    );
  }

  protected override onCapsEpoch(): void {
    this.refresh();
  }
  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    this.refresh();
  }

  private refresh(): void {
    if (this.disposed) return;
    const host = this.caps.has(AXIS_INPUT_HOST_CAP) ? this.caps.get(AXIS_INPUT_HOST_CAP) : null;
    const targets = this.mountPhase === 'mounted' && host ? this.resolveTargets() : null;
    if (this.lease && host === this.host && this.sameTargets(targets)) {
      this.lease.update({
        inputTarget: targets!.input,
        geometryTarget: targets!.geometry,
        ...(targets!.travel ? { travelTarget: targets!.travel } : {}),
        ...(targets!.deltaBasis ? { deltaBasisTargets: targets!.deltaBasis } : {}),
        config: this.config,
        onSample: this.receiver(this.epoch),
      });
      return;
    }
    const epoch = this.disconnect(
      targets ? 'target-replaced' : this.mountPhase === 'mounted' ? 'target-detached' : 'disposed'
    );
    if (epoch !== this.epoch || this.disposed || this.mountPhase !== 'mounted' || !host || !targets)
      return;
    this.host = host;
    this.targets = targets;
    const lease = host.attach({
      inputTarget: targets.input,
      geometryTarget: targets.geometry,
      ...(targets.travel ? { travelTarget: targets.travel } : {}),
      ...(targets.deltaBasis ? { deltaBasisTargets: targets.deltaBasis } : {}),
      config: this.config,
      onSample: this.receiver(epoch),
    });
    if (epoch !== this.epoch || this.disposed || this.mountPhase !== 'mounted') {
      lease.dispose();
      return;
    }
    this.lease = lease;
  }

  private receiver(epoch: number) {
    return (sample: AxisInputSample) => {
      if (epoch !== this.epoch || this.disposed || this.mountPhase !== 'mounted') return;
      // A delayed host callback cannot revive a reassociated logical owner even
      // if every host object was reused and notification delivery is still pending.
      if (this.targets?.ownership && !this.sameTargets(this.resolveTargets())) {
        this.refresh();
        return;
      }
      if (sample.phase === 'start') {
        if (this.active || this.config.disabled || this.config.readOnly) return;
        this.active = true;
      } else {
        if (!this.active) return;
        if (sample.phase === 'end' || sample.phase === 'cancel') this.active = false;
      }
      this.dispatch(sample);
    };
  }

  private dispatch(sample: AxisInputSample): void {
    if (this.listeners.length === 0 || this.sys.isDisposed()) return;
    const deliveryEpoch = ++this.deliveryEpoch;
    const dispatch = () => {
      const run = this.sys.getCallbackCtx() as RunHandle<PropsBaseType> | undefined;
      if (!run) throw new Error('[AxisInput] Host sample requires callback scope.');
      const epoch = this.epoch;
      for (const listener of [...this.listeners]) {
        if (deliveryEpoch !== this.deliveryEpoch) break;
        listener(run, sample);
        if (epoch !== this.epoch || this.disposed) break;
      }
    };
    if (this.sys.getCallbackCtx()) dispatch();
    else this.caps.get(AXIS_INPUT_RUN_IN_CALLBACK_CAP)(dispatch);
  }

  private disconnect(reason: AxisInputCancelReason): number {
    const epoch = ++this.epoch;
    const lease = this.lease;
    this.lease = null;
    this.host = null;
    this.targets = null;
    const active = this.active;
    this.active = false;
    lease?.dispose();
    if (active) this.dispatch(Object.freeze({ phase: 'cancel', reason }));
    return epoch;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disconnect('disposed');
    this.subscriptions.splice(0).forEach((off) => off());
    this.listeners = [];
  }
}

export function createAxisInputModule({ init, caps, deps }: ModuleFactoryArgs) {
  return createModule({
    name: 'axis-input',
    scope: 'instance',
    init,
    caps,
    deps,
    build: () => {
      const impl = new AxisInputModuleImpl(caps, deps.requirePort<AnatomyPort>('anatomy'));
      return {
        facade: { declare: () => impl.declare() },
        hooks: {
          onMountPhase: (phase, epoch) => impl.onMountPhase(phase, epoch),
          dispose: () => impl.dispose(),
        },
      };
    },
  });
}
export const AxisInputModuleDef = defineModule({
  name: 'axis-input',
  resourceOwnership: 'mixed',
  deps: ['anatomy'],
  create: createAxisInputModule,
});
