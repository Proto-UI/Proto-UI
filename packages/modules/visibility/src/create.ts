import type {
  HideableConfig,
  HideableHandle,
  OwnedStateHandle,
  VisibilityFacts,
} from '@proto.ui/core';
import { createModule, defineModule, ModuleBase } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';
import type { StateFacade, StatePort } from '@proto.ui/module-state';
import type { PropsBaseType } from '@proto.ui/types';
import type { VisibilityFacade, VisibilityModule, VisibilityPort } from './types';
import { VISIBILITY_HOST_BRIDGE_CAP } from './caps';

class VisibilityModuleImpl extends ModuleBase {
  private readonly hiddenOwned: OwnedStateHandle<boolean>;
  private readonly hiddenObserved: HideableHandle<any>['hidden'];
  private readonly hideableHandle: HideableHandle<any>;
  private config: HideableConfig = Object.freeze({ defaultHidden: false });
  private declared = false;

  constructor(
    caps: ModuleFactoryArgs['caps'],
    private readonly statePort: StatePort,
    stateFacade: StateFacade
  ) {
    super(caps);

    this.hiddenOwned = stateFacade.bool('@visibility/hidden', false);
    (this.hiddenOwned as any).__stateName = 'hidden';
    this.hiddenObserved = statePort.createObservedHandle(this.hiddenOwned) as any;

    this.hideableHandle = {
      hidden: this.hiddenObserved,
      setDefaultHidden: (hidden: boolean) => this.setDefaultHidden(hidden),
      hide: () => this.setHidden(true, 'visibility.hide'),
      show: () => this.setHidden(false, 'visibility.show'),
      setHidden: (hidden: boolean) => this.setHidden(hidden, 'visibility.setHidden'),
    };
  }

  getHideable<P extends PropsBaseType = PropsBaseType>(): HideableHandle<P> {
    this.declared = true;
    this.project();
    return this.hideableHandle as HideableHandle<P>;
  }

  setDefaultHidden(hidden: boolean): void {
    this.sys.ensureSetup('visibility.setDefaultHidden');
    this.config = Object.freeze({ defaultHidden: hidden });
    this.statePort.setDefault(this.hiddenOwned, hidden);
    this.project();
  }

  setHidden(hidden: boolean, reason: string): void {
    this.sys.ensureCallback(reason);
    this.statePort.set(this.hiddenOwned, hidden, reason, this.sys.getCallbackCtx());
    this.project();
  }

  getFacts(): VisibilityFacts {
    return Object.freeze({
      hidden: this.hiddenObserved.get(),
    });
  }

  getConfig(): HideableConfig {
    return this.config;
  }

  protected override onCapsEpoch(_epoch: number): void {
    this.project();
  }

  private project(): void {
    if (!this.declared) return;
    if (!this.caps.has(VISIBILITY_HOST_BRIDGE_CAP)) return;
    this.caps.get(VISIBILITY_HOST_BRIDGE_CAP).project(this.getFacts());
  }
}

export function createVisibilityModule(ctx: ModuleFactoryArgs): VisibilityModule {
  const { init, caps, deps } = ctx;

  return createModule<'visibility', 'instance', VisibilityFacade, VisibilityPort>({
    name: 'visibility',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ deps }) => {
      const statePort = deps.requirePort<StatePort>('state');
      const stateFacade = deps.requireFacade<StateFacade>('state');
      const impl = new VisibilityModuleImpl(caps, statePort, stateFacade);

      return {
        facade: {
          getHideable: () => impl.getHideable(),
        },
        hooks: {
          onProtoPhase: (phase) => impl.onProtoPhase(phase),
        },
        port: {
          getFacts: () => impl.getFacts(),
          getConfig: () => impl.getConfig(),
        },
      };
    },
  }) as VisibilityModule;
}

export const VisibilityModuleDef = defineModule({
  name: 'visibility',
  deps: ['state'],
  create: createVisibilityModule,
});
