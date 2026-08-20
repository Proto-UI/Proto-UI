// packages/modules/expose-state-web/src/create.ts
import { createModule, defineModule } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';

import type { ExposeStateWebFacade, ExposeStateWebModule, ExposeStateWebPort } from './types';
import { ExposeStateWebModuleImpl } from './impl';

export function createExposeStateWebModule(ctx: ModuleFactoryArgs): ExposeStateWebModule {
  const { init, caps, deps } = ctx;

  return createModule<'expose-state-web', 'instance', ExposeStateWebFacade, ExposeStateWebPort>({
    name: 'expose-state-web',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ caps, deps }) => {
      const impl = new ExposeStateWebModuleImpl(caps, deps);

      return {
        facade: {},
        port: impl.port,
        hooks: {
          onInstancePhase: (p) => impl.onInstancePhase(p),
          onMountPhase: (p, epoch) => impl.onMountPhase(p, epoch),
          afterRenderCommit: () => impl.afterRenderCommit(),
          dispose: () => impl.dispose(),
        },
      };
    },
  });
}

export const ExposeStateWebModuleDef = defineModule({
  name: 'expose-state-web',
  resourceOwnership: 'mixed',
  deps: ['expose-state'],
  optionalDeps: ['expose'],
  create: createExposeStateWebModule,
});
