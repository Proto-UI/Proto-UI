import { createModule, defineModule } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';
import type { ExposePort } from '@proto.ui/module-expose';

import type { AnatomyFacade, AnatomyModule, AnatomyPort } from './types';
import { AnatomyModuleImpl } from './impl';

export function createAnatomyModule(ctx: ModuleFactoryArgs): AnatomyModule {
  const { init, caps, deps } = ctx;
  const exposePort = deps.requirePort<ExposePort>('expose');

  return createModule<'anatomy', 'instance', AnatomyFacade, AnatomyPort>({
    name: 'anatomy',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ init, caps }) => {
      const impl = new AnatomyModuleImpl(caps, init.prototypeName, exposePort);
      return {
        facade: {
          claim: (family, decl) => impl.claim(family, decl),
          subscribeParts: (family, role, cb) => impl.subscribeParts(family, role, cb),
          has: (family, role) => impl.has(family, role),
          parts: ((family, options) =>
            impl.parts(family, options as any)) as AnatomyFacade['parts'],
          partsOf: ((family, role, options) =>
            impl.partsOf(family, role, options as any)) as AnatomyFacade['partsOf'],
          descendantsOf: (family, ancestor, role) => impl.descendantsOf(family, ancestor, role),
          order: {
            version: ((family, options) =>
              impl.orderVersion(family, options as any)) as AnatomyFacade['order']['version'],
            parts: ((family, options) =>
              impl.orderedParts(family, options as any)) as AnatomyFacade['order']['parts'],
            partsOf: ((family, role, options) =>
              impl.orderedPartsOf(
                family,
                role,
                options as any
              )) as AnatomyFacade['order']['partsOf'],
            indexOfSelf: ((family, role, options) =>
              impl.indexOfSelf(
                family,
                role,
                options as any
              )) as AnatomyFacade['order']['indexOfSelf'],
            prevOfSelf: ((family, role, options) =>
              impl.prevOfSelf(
                family,
                role,
                options as any
              )) as AnatomyFacade['order']['prevOfSelf'],
            nextOfSelf: ((family, role, options) =>
              impl.nextOfSelf(
                family,
                role,
                options as any
              )) as AnatomyFacade['order']['nextOfSelf'],
          },
        },
        port: impl.port as AnatomyPort,
        hooks: {
          onMountPhase: (p, epoch) => impl.onMountPhase(p, epoch),
          onProtoPhase: (p) => impl.onProtoPhase(p),
          dispose: () => impl.dispose(),
        },
      };
    },
  });
}

export const AnatomyModuleDef = defineModule({
  name: 'anatomy',
  resourceOwnership: 'mixed',
  deps: ['expose'],
  create: createAnatomyModule,
});
