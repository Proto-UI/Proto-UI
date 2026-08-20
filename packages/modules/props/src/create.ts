// packages/modules/props/src/create.ts
import { createModule, defineModule } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';
import type { PropsBaseType } from '@proto.ui/types';

import type { PropsFacade, PropsModule, PropsPort } from './types';
import { PropsModuleImpl } from './impl';

export function createPropsModule<P extends PropsBaseType>(ctx: ModuleFactoryArgs): PropsModule<P> {
  const { init, caps, deps } = ctx;

  return createModule<'props', 'instance', PropsFacade<P>, PropsPort<P>>({
    name: 'props',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ init, caps }) => {
      const impl = new PropsModuleImpl<P>(caps, init.prototypeName);

      return {
        facade: {
          define: (decl) => impl.define(decl),
          setDefaults: (partial) => impl.setDefaults(partial),

          watch: (keys, cb) => impl.watchKeys(keys as any, cb as any),
          watchAll: (cb) => impl.watchAllKeys(cb as any),
          watchRaw: (keys, cb) => impl.watchRawKeys(keys as any, cb as any, true),
          watchRawAll: (cb) => impl.watchRawAllKeys(cb as any, true),

          get: () => impl.get(),
          getRaw: () => impl.getRaw(),
          isProvided: (key) => impl.isProvided(key as any),
        },
        hooks: {
          onProtoPhase: (p) => impl.onProtoPhase(p),
          dispose: () => impl.dispose(),
        },
        port: {
          syncFromHost: () => impl.syncFromHost(),
          applyRaw: (nextRaw) => impl.applyRaw(nextRaw),
          consumeTasks: () => impl.consumeTasks(),
          getDiagnostics: () => impl.getDiagnostics(),
        },
      };
    },
  }) as PropsModule<P>;
}

export const PropsModuleDef = defineModule({
  name: 'props',
  resourceOwnership: 'instance',
  deps: [],
  create: createPropsModule,
});
