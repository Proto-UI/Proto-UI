// packages/modules/event/src/create.ts
import { createModule, defineModule } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';

import type { EventFacade, EventModule, EventPort } from './types';
import { EventModuleImpl } from './impl';

export function createEventModule(ctx: ModuleFactoryArgs): EventModule {
  const { init, caps, deps } = ctx;

  return createModule<'event', 'instance', EventFacade, EventPort>({
    name: 'event',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ init, caps }) => {
      const impl = new EventModuleImpl(caps, init.prototypeName);

      return {
        facade: {
          on: (type, options) => impl.on(type, options),
          onGlobal: (type, options) => impl.onGlobal(type, options),
          off: (token) => impl.off(token),
        },
        hooks: {
          onProtoPhase: (p) => impl.onProtoPhase(p),
        },
        port: {
          on: (type, cb, options) => impl.onInternal(type, cb, options),
          onGlobal: (type, cb, options) => impl.onGlobalInternal(type, cb, options),
          bind: (dispatch) => impl.bind(dispatch),
          unbind: () => impl.unbind(),
          getDiagnostics: () => impl.getDiagnostics(),
          requestDefaultActionPrevented: (ev, options) =>
            impl.requestDefaultActionPrevented(ev, options),
          redirectRoot: (target) => impl.redirectRoot(target),
          redirectSemanticRoot: (target) => impl.redirectSemanticRoot(target),
          dispatchInternal: (id, ev) => impl.dispatchInternal(id, ev),
        },
      };
    },
  });
}

export const EventModuleDef = defineModule({
  name: 'event',
  resourceOwnership: 'mixed',
  deps: [],
  create: createEventModule,
});
