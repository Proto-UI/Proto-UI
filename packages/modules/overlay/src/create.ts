import { createModule, defineModule } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';

import type { OverlayFacade, OverlayModule, OverlayPort } from './types';
import { OverlayModuleImpl } from './impl';
import type { BoundaryFacade } from '@proto.ui/module-boundary';
import type { BoundaryPort } from '@proto.ui/module-boundary';
import type { EventPort } from '@proto.ui/module-event';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import type { PositioningFacade } from '@proto.ui/module-positioning';

export function createOverlayModule(ctx: ModuleFactoryArgs): OverlayModule {
  const { init, caps, deps } = ctx;

  return createModule<'overlay', 'instance', OverlayFacade, OverlayPort>({
    name: 'overlay',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ init, caps }) => {
      const boundaryFacade = deps.requireFacade<BoundaryFacade>('boundary');
      const impl = new OverlayModuleImpl(
        caps,
        init.prototypeName,
        boundaryFacade.getBoundary(),
        deps.requirePort<BoundaryPort>('boundary'),
        deps.requirePort<EventPort>('event'),
        deps.requirePort<AnatomyPort>('anatomy'),
        deps.requireFacade<PositioningFacade>('positioning').getAnchoredPosition()
      );

      return {
        facade: {
          getOverlay: () => impl.handle,
        },
        hooks: {
          onMountPhase: (p, epoch) => impl.onMountPhase(p, epoch),
          onProtoPhase: (p) => impl.onProtoPhase(p),
        },
        port: {
          configure: (patch) => impl.configure(patch),
          open: (reason) => impl.open(reason),
          close: (reason) => impl.close(reason),
          toggle: (reason) => impl.toggle(reason),
          isOpen: () => impl.isOpen(),
          getConfig: () => impl.getConfig(),
          getWarnings: () => impl.getWarnings(),
          getLastReason: () => impl.getLastReason(),
          getRegistration: () => impl.getRegistration(),
          getPositionSnapshot: () => impl.getPositionSnapshot(),
          registerTrigger: (target) => impl.registerTrigger(target),
          registerAnchor: (target) => impl.registerAnchor(target),
          registerAnchorPart: (part) => impl.registerAnchorPart(part),
          registerContent: (target) => impl.registerContent(target),
          updatePosition: (patch) => impl.updatePosition(patch),
          setViewActive: (active) => impl.setViewActive(active),
          markPresenceBound: () => impl.markPresenceBound(),
          hasPresenceBinding: () => impl.hasPresenceBinding(),
          reconcileViewResourcesAfterCallback: () => impl.reconcileViewResourcesAfterCallback(),
        },
      };
    },
  }) as OverlayModule;
}

export const OverlayModuleDef = defineModule({
  name: 'overlay',
  resourceOwnership: 'mixed',
  deps: ['boundary', 'event', 'anatomy', 'positioning'],
  create: createOverlayModule,
});
