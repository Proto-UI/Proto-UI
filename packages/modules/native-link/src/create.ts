import {
  getModuleDeclaration,
  type MountPhase,
  type NativeLinkConfig,
  type NativeLinkHandle,
  type NativeLinkNavigate,
  type NativeLinkSnapshot,
  type PrototypeModuleDeclaration,
  type RunHandle,
} from '@proto.ui/core';
import {
  createModule,
  defineModule,
  ModuleBase,
  type ModuleFactoryArgs,
} from '@proto.ui/module-base';
import type { PropsBaseType } from '@proto.ui/types';
import {
  NATIVE_LINK_HOST_CAP,
  NATIVE_LINK_RUN_IN_CALLBACK_CAP,
  type NativeLinkHostLease,
} from './caps';
import { normalizeNativeLinkConfig } from './config';
import { NATIVE_LINK_DECLARATION } from './declaration';

type Listener = (run: RunHandle<PropsBaseType>, event: NativeLinkNavigate) => void;
export class NativeLinkModuleImpl extends ModuleBase {
  private readonly hasDeclaration: boolean;
  private declared = false;
  private disposed = false;
  private config = normalizeNativeLinkConfig({});
  private lease: NativeLinkHostLease | null = null;
  private epoch = 0;
  private listeners = new Set<Listener>();

  constructor(
    caps: ModuleFactoryArgs['caps'],
    declarations: readonly PrototypeModuleDeclaration[]
  ) {
    super(caps);
    this.hasDeclaration = !!getModuleDeclaration(
      { modules: declarations },
      NATIVE_LINK_DECLARATION
    );
  }
  declare<P extends PropsBaseType>(): NativeLinkHandle<P> {
    this.sys.ensureSetup('nativeLink.declare');
    if (!this.hasDeclaration)
      throw new Error('[NativeLink] requires a static native-link declaration.');
    if (this.declared) throw new Error('[NativeLink] only one link may be declared per owner.');
    this.declared = true;
    return {
      sync: (config) => this.sync(config),
      snapshot: () => this.snapshot(),
      on: (type, callback) => {
        this.sys.ensureSetup('nativeLink.on');
        if (type !== 'navigate') throw new Error('[NativeLink] unsupported observation.');
        const listener = callback as Listener;
        this.listeners.add(listener);
        return () => {
          this.sys.ensureSetup('nativeLink.off');
          this.listeners.delete(listener);
        };
      },
    };
  }
  private sync(config: NativeLinkConfig) {
    this.sys.ensureCallback('nativeLink.sync');
    if (this.disposed) return;
    this.config = normalizeNativeLinkConfig(config);
    this.lease?.update(this.config);
  }
  snapshot(): NativeLinkSnapshot | null {
    return this.declared && !this.disposed ? this.config : null;
  }
  protected override onCapsEpoch() {
    this.attach();
  }
  override onMountPhase(phase: MountPhase, epoch: number) {
    super.onMountPhase(phase, epoch);
    if (phase === 'mounted') this.attach(true);
    else if (phase === 'unmounting' || phase === 'detached') this.release();
  }
  private release() {
    ++this.epoch;
    const lease = this.lease;
    this.lease = null;
    lease?.dispose();
  }
  private attach(requireHost = false) {
    this.release();
    if (this.disposed || !this.declared || this.mountPhase !== 'mounted') return;
    if (!this.caps.has(NATIVE_LINK_HOST_CAP)) {
      if (requireHost)
        throw new Error('[NativeLink] this adapter does not provide a native navigation target.');
      return;
    }
    const host = this.caps.get(NATIVE_LINK_HOST_CAP);
    const epoch = this.epoch;
    const initial = this.config;
    const lease = host.attach({
      config: initial,
      onNavigate: (event) => this.receive(epoch, event),
    });
    if (this.disposed || epoch !== this.epoch || this.mountPhase !== 'mounted') {
      lease.dispose();
      return;
    }
    this.lease = lease;
    if (initial !== this.config) lease.update(this.config);
  }
  private receive(epoch: number, event: NativeLinkNavigate) {
    const isLive = () => !this.disposed && epoch === this.epoch && this.mountPhase === 'mounted';
    if (!isLive() || this.config.disabled || !this.config.href || !this.listeners.size) return;
    const dispatch = () => {
      const run = this.sys.getCallbackCtx() as RunHandle<PropsBaseType> | undefined;
      if (!run) throw new Error('[NativeLink] navigation requires callback scope.');
      for (const listener of [...this.listeners]) {
        if (!isLive()) break;
        listener(run, event);
      }
    };
    if (this.sys.getCallbackCtx()) dispatch();
    else this.caps.get(NATIVE_LINK_RUN_IN_CALLBACK_CAP)(dispatch);
  }
  dispose() {
    this.disposed = true;
    this.release();
    this.listeners.clear();
  }
}
export function createNativeLinkModule(ctx: ModuleFactoryArgs) {
  return createModule({
    name: 'native-link',
    scope: 'instance',
    ...ctx,
    build: ({ init, caps }) => {
      const impl = new NativeLinkModuleImpl(caps, init.declarations);
      return {
        facade: { declare: <P extends PropsBaseType>() => impl.declare<P>() },
        hooks: {
          onMountPhase: (phase, epoch) => impl.onMountPhase(phase, epoch),
          dispose: () => impl.dispose(),
        },
        port: { isDeclared: () => impl.snapshot() !== null, getSnapshot: () => impl.snapshot() },
      };
    },
  });
}
export const NativeLinkModuleDef = defineModule({
  name: 'native-link',
  resourceOwnership: 'mixed',
  create: createNativeLinkModule,
});
