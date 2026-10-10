import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { ContextMenuInputModuleImpl } from './context-menu-input';
import { createModule, defineModule, type ModuleFactoryArgs } from '@proto.ui/module-base';
import { PositioningModuleImpl } from './impl';
import type { PositioningFacade, PositioningModule, PositioningPort } from './types';

export function createPositioningModule(ctx: ModuleFactoryArgs): PositioningModule {
  const { init, caps, deps } = ctx;
  const impl = new PositioningModuleImpl(caps);
  const input = new ContextMenuInputModuleImpl(caps, deps.requirePort<AnatomyPort>('anatomy'));

  return createModule<'positioning', 'instance', PositioningFacade, PositioningPort>({
    name: 'positioning',
    scope: 'instance',
    init,
    caps,
    deps,
    build: () => ({
      facade: {
        declareContextMenuInput: () => input.declare(),
        getAnchoredPosition: () => impl.handle,
        getAvailableSpace: () => impl.availableHandle,
      },
      port: {
        getAnchoredPosition: () => impl.handle,
        getAvailableSpace: () => impl.availableHandle,
      },
      hooks: {
        onProtoPhase: (phase) => impl.onProtoPhase(phase),
        onMountPhase: (phase, epoch) => input.onMountPhase(phase, epoch),
        dispose: () => input.dispose(),
      },
    }),
  }) as PositioningModule;
}

export const PositioningModuleDef = defineModule({
  name: 'positioning',
  resourceOwnership: 'mixed',
  deps: ['anatomy'],
  create: createPositioningModule,
});
