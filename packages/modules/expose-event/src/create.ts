import { createModule, defineModule, type ModuleFactoryArgs } from '@proto.ui/module-base';

import { ExposeEventModuleImpl } from './impl';
import type { ExposeEventFacade, ExposeEventModule } from './types';

export function createExposeEventModule(ctx: ModuleFactoryArgs): ExposeEventModule {
  return createModule<'expose-event', 'instance', ExposeEventFacade>({
    name: 'expose-event',
    scope: 'instance',
    init: ctx.init,
    caps: ctx.caps,
    deps: ctx.deps,
    build: ({ init, caps, deps }) => {
      const impl = new ExposeEventModuleImpl(caps, deps, init.prototypeName);
      return { facade: impl.facade };
    },
  });
}

export const ExposeEventModuleDef = defineModule({
  name: 'expose-event',
  resourceOwnership: 'instance',
  deps: ['expose'],
  create: createExposeEventModule,
});
