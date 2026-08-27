// packages/modules/event/src/create.ts
import { createModule, defineModule } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';
import type { EventTypeV0, HostEventListenerOptions } from '@proto.ui/types';

import type { EventFacade, EventInternalCallback, EventModule, EventPort } from './types';
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
          on: ((type: EventTypeV0, options?: HostEventListenerOptions) =>
            impl.on(type, options)) as EventFacade['on'],
          onGlobal: ((type: EventTypeV0, options?: HostEventListenerOptions) =>
            impl.onGlobal(type, options)) as EventFacade['onGlobal'],
          off: (token) => impl.off(token),
        },
        hooks: {
          onProtoPhase: (p) => impl.onProtoPhase(p),
        },
        port: {
          on: ((type: EventTypeV0, cb: EventInternalCallback, options?: HostEventListenerOptions) =>
            impl.onInternal(type, cb, options)) as EventPort['on'],
          onGlobal: ((
            type: EventTypeV0,
            cb: EventInternalCallback,
            options?: HostEventListenerOptions
          ) => impl.onGlobalInternal(type, cb, options)) as EventPort['onGlobal'],
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
