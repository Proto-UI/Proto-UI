// packages/modules/rule/src/create.ts
import { createModule, defineModule, SYS_CAP } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';
import type { PropsBaseType } from '@proto.ui/types';

import type { RuleFacade, RuleModule, RulePort } from './types';
import { RuleModuleImpl } from './impl';
import type { PropsFacade, PropsPort } from '@proto.ui/module-props';
import type { StatePort } from '@proto.ui/module-state';
import type { FeedbackPort } from '@proto.ui/module-feedback';
import type { ContextFacade } from '@proto.ui/module-context';

export function createRuleModule<Props extends PropsBaseType>(
  ctx: ModuleFactoryArgs
): RuleModule<Props> {
  const { init, caps, deps } = ctx;

  return createModule<'rule', 'instance', RuleFacade<Props>, RulePort<Props>>({
    name: 'rule',
    scope: 'instance',
    init,
    caps,
    deps,
    build: () => {
      const impl = new RuleModuleImpl<Props>();

      const resolveDeps = () => ({
        propsFacade: deps.tryFacade<PropsFacade<Props>>('props'),
        propsPort: deps.tryPort<PropsPort<Props>>('props'),
        statePort: deps.tryPort<StatePort>('state'),
        feedbackPort: deps.tryPort<FeedbackPort>('feedback'),
        contextFacade: deps.tryFacade<ContextFacade>('context'),
      });

      impl.attachExecutor(resolveDeps);

      return {
        facade: {
          rule: (spec) => {
            // Cancellation is part of author setup composition, including when
            // the handle is obtained directly rather than through asHook.
            caps.get(SYS_CAP).ensureSetup('def.rule');
            const handle = impl.define(spec);
            return {
              id: handle.id,
              dispose: () => {
                caps.get(SYS_CAP).ensureSetup('def.rule.dispose');
                handle.dispose();
              },
            };
          },
        },
        port: {
          exportIR: () => impl.exportIR(),
          resolveStateHandle: (id) => impl.resolveStateHandle(id),
          evaluate: (ctx) => impl.evaluate(ctx as any),
          registerExtension: (ext) => impl.registerExtension(ext as any),
        },
        hooks: {
          onMountPhase: (p) => impl.onMountPhase(p),
          onProtoPhase: (p) => impl.onProtoPhase(p),
          dispose: () => impl.dispose(),
        },
      };
    },
  }) as RuleModule<Props>;
}

export const RuleModuleDef = defineModule({
  name: 'rule',
  resourceOwnership: 'mixed',
  deps: [],
  optionalDeps: ['props', 'state', 'context', 'feedback'],
  create: createRuleModule,
});
