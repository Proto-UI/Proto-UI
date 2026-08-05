import { createModule, defineModule, type ModuleFactoryArgs } from '@proto.ui/module-base';
import { TextControlModuleImpl } from './impl';
import type { TextControlFacade, TextControlPort } from './types';

export function createTextControlModule(ctx: ModuleFactoryArgs) {
  return createModule<'text-control', 'instance', TextControlFacade, TextControlPort>({
    name: 'text-control',
    scope: 'instance',
    init: ctx.init,
    caps: ctx.caps,
    deps: ctx.deps,
    build: ({ init, caps }) => {
      const impl = new TextControlModuleImpl(caps, init.prototypeName, init.declarations);
      return {
        facade: {
          declare: () => impl.declare(),
        },
        hooks: {
          onMountPhase: (phase, epoch) => impl.onMountPhase(phase, epoch),
          dispose: () => impl.dispose(),
        },
        port: {
          isDeclared: () => impl.snapshot() !== null,
          getSnapshot: () => impl.snapshot(),
        },
      };
    },
  });
}

export const TextControlModuleDef = defineModule({
  name: 'text-control',
  resourceOwnership: 'mixed',
  create: createTextControlModule,
});
