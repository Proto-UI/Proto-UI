import type {
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
});
type Listener = (run: RunHandle<PropsBaseType>, sample: AxisInputSample) => void;

class AxisInputModuleImpl extends ModuleBase {
  private declared = false;
  private binding: AxisInputBinding | null = null;
  private config = INITIAL_CONFIG;
  private listeners: Listener[] = [];
  private subscriptions: (() => void)[] = [];
  private lease: AxisInputHostLease | null = null;
  private host: AxisInputHost | null = null;
  private targets: { input: unknown; geometry: unknown } | null = null;
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
          !binding.anatomy.decl.roles[binding.geometryRole]
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
        const next: AxisInputConfig = Object.freeze({
          axis: patch.axis ?? this.config.axis,
          direction: patch.direction ?? this.config.direction,
          disabled: patch.disabled ?? this.config.disabled,
          readOnly: patch.readOnly ?? this.config.readOnly,
          reverse: patch.reverse ?? this.config.reverse,
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

  private resolveTargets() {
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
    return inputTarget && geometryTarget ? { input: inputTarget, geometry: geometryTarget } : null;
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
    if (
      this.lease &&
      host === this.host &&
      targets?.input === this.targets?.input &&
      targets?.geometry === this.targets?.geometry
    ) {
      this.lease.update({
        inputTarget: targets!.input,
        geometryTarget: targets!.geometry,
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
