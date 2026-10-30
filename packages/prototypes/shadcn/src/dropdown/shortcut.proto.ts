import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownShortcut, type DropdownShortcutProps } from '@proto.ui/prototypes-base/dropdown';
import { type ShadcnStyleProps } from '../style-scope';
import { setupMenuStyle } from './visual';
export default definePrototype<DropdownShortcutProps & ShadcnStyleProps>({
  name: 'shadcn-dropdown-shortcut',
  modules: asDropdownShortcut.modules,
  setup(def) {
    const state = asDropdownShortcut();
    const style = setupMenuStyle(def);
    def.feedback.style.use(tw('ml-auto tracking-widest text-muted-foreground'));
    def.rule({
      when: (w) => w.state(style).eq('mira'),
      intent: (i) => i.feedback.style.use(tw('text-[0.625rem]')),
    });
    def.rule({
      when: (w) => w.not(w.state(style).eq('mira')),
      intent: (i) => i.feedback.style.use(tw('text-xs')),
    });
    if (!state.stateHandles) throw new Error('Dropdown Shortcut capture missing');
    def.rule({
      when: (w) => w.state(state.stateHandles!.active).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-accent-foreground')),
    });
  },
});
