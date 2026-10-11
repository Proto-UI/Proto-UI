import { createModule, defineModule } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';
import type { BoundaryFacade, BoundaryPort } from './types';
import { BoundaryModuleImpl } from './impl';
import type { EventPort } from '@proto.ui/module-event';

export function createBoundaryModule(ctx: ModuleFactoryArgs) {
  const { init, caps, deps } = ctx;

  return createModule<'boundary', 'instance', BoundaryFacade, BoundaryPort>({
    name: 'boundary',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ init, caps }) => {
      const impl = new BoundaryModuleImpl(
        caps,
        init.prototypeName,
        deps.requirePort<EventPort>('event')
      );

      return {
        facade: {
          getBoundary: () => impl.handle,
        },
        hooks: {
          onMountPhase: (phase, epoch) => impl.onMountPhase(phase, epoch),
          onProtoPhase: (phase) => impl.onProtoPhase(phase),
        },
        port: {
          configure: (patch) => impl.configure(patch),
          setStackActive: (active) => impl.setStackActive(active),
          registerRegion: (target, options) => impl.registerRegion(target, options),
          unregisterRegion: (target) => impl.unregisterRegion(target),
          classify: (sample) => impl.classify(sample),
          notify: (sample) => impl.notify(sample),
          observe: (observation) => impl.observe(observation),
          subscribeOutside: (cb) => impl.subscribeOutside(cb),
          getConfig: () => impl.getConfig(),
          getWarnings: () => impl.getWarnings(),
          getRegions: () => impl.getRegions(),
          replaceImplicitRoot: (target) => impl.replaceImplicitRoot(target),
        },
      };
    },
  });
}

export const BoundaryModuleDef = defineModule({
  name: 'boundary',
  resourceOwnership: 'mixed',
  deps: ['event'],
  create: createBoundaryModule,
});
