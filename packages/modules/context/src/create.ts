// packages/modules/context/src/create.ts
import { createModule, defineModule } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';

import type { ContextFacade, ContextModule, ContextPort } from './types';
import { ContextModuleImpl } from './impl';

export function createContextModule(ctx: ModuleFactoryArgs): ContextModule {
  const { init, caps, deps } = ctx;

  return createModule<'context', 'singleton', ContextFacade, ContextPort>({
    name: 'context',
    scope: 'singleton',
    init,
    caps,
    deps,
    build: ({ init, caps }) => {
      const impl = new ContextModuleImpl(caps, init.prototypeName);

      return {
        facade: {
          provide: (key, value) => impl.provide(key as any, value as any),
          subscribe: (key, cb) => impl.subscribe(key as any, cb as any),
          trySubscribe: (key, cb) => impl.trySubscribe(key as any, cb as any),

          read: (key) => impl.read(key as any),
          tryRead: (key) => impl.tryRead(key as any),
          update: (key, next) => impl.update(key as any, next as any),
          tryUpdate: (key, next) => impl.tryUpdate(key as any, next as any),
        },
        hooks: {
          onProtoPhase: (p) => impl.onProtoPhase(p),
          dispose: () => impl.dispose(),
        },
        port: {
          setCallbackDispatcher: (dispatch) => impl.setCallbackDispatcher(dispatch),
          resolveScope: (key, consumer) => impl.resolveScope(key, consumer),
          dumpProviders: () => impl.portDumpProviders(),
          dumpSubscriptions: () => impl.portDumpSubscriptions(),
          dumpCallbackQueue: () => impl.portDumpCallbackQueue(),
        },
      };
    },
  });
}

export const ContextModuleDef = defineModule({
  name: 'context',
  resourceOwnership: 'instance',
  deps: [],
  create: createContextModule,
});
