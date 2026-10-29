import { definePrototype, tw } from '@proto.ui/core';
import { asToggleGroupRoot } from '@proto.ui/prototypes-base/toggle-group';
import { setupShadcnStyleScope, setupShadcnStyleSelection } from '../style-scope';
import type { ShadcnToggleGroupRootProps, ShadcnToggleGroupRootExposes } from './types';

/** MIT shadcn-ui/ui@3d98900e: bases/base/ui/toggle-group.tsx, style-*.css
 * .cn-toggle-group, and independent new-york-v4/ui/toggle-group.tsx.
 * Modern default spacing is 2 (0.5rem); New York's separate default is 0.
 * Base alone owns orientation, keyboard navigation and group selection.
 */
export default definePrototype<ShadcnToggleGroupRootProps, ShadcnToggleGroupRootExposes>({
  name: 'shadcn-toggle-group-root',
  setup(def) {
    const behavior = asToggleGroupRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-toggle-group] Root state unavailable.');
    setupShadcnStyleScope(def);
    const style = setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('flex w-fit min-w-0 text-foreground'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row items-center')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col items-stretch')),
    });
    def.rule({
      when: (w) => w.not(w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('gap-2')),
    });
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('gap-0 rounded-md')),
    });
    def.rule({
      when: (w) => w.any(w.state(style).eq('vega'), w.state(style).eq('mira')),
      intent: (i) => i.feedback.style.use(tw('rounded-md')),
    });
    def.rule({
      when: (w) => w.state(style).eq('nova'),
      intent: (i) => i.feedback.style.use(tw('rounded-lg')),
    });
    def.rule({
      when: (w) => w.state(style).eq('lyra'),
      intent: (i) => i.feedback.style.use(tw('rounded-none')),
    });
    return behavior.render;
  },
});
