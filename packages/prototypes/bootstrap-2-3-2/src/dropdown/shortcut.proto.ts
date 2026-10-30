import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownShortcut, type DropdownShortcutProps } from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownShortcutProps>({
  name: 'bootstrap-2-3-2-dropdown-shortcut',
  modules: asDropdownShortcut.modules,
  setup(def) {
    const state = asDropdownShortcut();
    // Shortcut is a passive Proto extension; it inherits its item's ink.
    def.feedback.style.use(tw('ml-auto text-[11px] leading-[20px]'));
    if (!state.stateHandles) throw new Error('Dropdown Shortcut capture missing');
    def.rule({
      when: (w) => w.state(state.stateHandles!.active).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-primary-foreground')),
    });
    return state.render;
  },
});
