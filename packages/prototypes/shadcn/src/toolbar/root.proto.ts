import { definePrototype, tw } from '@proto.ui/core';
import { asToolbarRoot } from '@proto.ui/prototypes-base/toolbar';
import { setupShadcnStyleScope } from '../style-scope';
import type { ShadcnToolbarRootProps, ShadcnToolbarRootExposes } from './types';

/** Proto Toolbar extension, not an official shadcn Toolbar or ButtonGroup API.
 * The semantic/layout root has no extra card surface. Its controls use the
 * independently source-bound family action recipes without another owner.
 */
export default definePrototype<ShadcnToolbarRootProps, ShadcnToolbarRootExposes>({
  name: 'shadcn-toolbar-root',
  modules: asToolbarRoot.modules,
  setup(def) {
    const behavior = asToolbarRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-toolbar] Root state unavailable.');
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('flex w-fit min-w-0 gap-1 text-foreground'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row items-center')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col items-stretch')),
    });
    return behavior.render;
  },
});
