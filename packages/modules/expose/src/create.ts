// packages/modules/expose/src/create.ts
import { createModule, defineModule } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';

import type { ExposeFacade, ExposeModule, ExposePort } from './types';
import { ExposeModuleImpl } from './impl';

export function createExposeModule(ctx: ModuleFactoryArgs): ExposeModule {
  const { init, caps, deps } = ctx;

  return createModule<'expose', 'instance', ExposeFacade, ExposePort>({
    name: 'expose',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ init, caps }) => {
      const impl = new ExposeModuleImpl(caps, init.prototypeName);

      return {
        facade: impl.facade,
        port: impl.port,
        hooks: {
          dispose: () => impl.dispose(),
        },
      };
    },
  });
}

export const ExposeModuleDef = defineModule({
  name: 'expose',
  resourceOwnership: 'instance',
  deps: [],
  create: createExposeModule,
});
