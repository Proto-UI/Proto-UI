import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownShortcut, type DropdownShortcutProps } from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownShortcutProps>({
  name: 'bootstrap-2-3-2-dropdown-shortcut',
  setup(def) {
    const state = asDropdownShortcut();
    def.feedback.style.use(tw('ml-auto text-xs text-muted-foreground'));
    if (!state.stateHandles) throw new Error('Dropdown Shortcut capture missing');
    def.rule({
      when: (w) => w.state(state.stateHandles!.active).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-primary-foreground')),
    });
  },
});
