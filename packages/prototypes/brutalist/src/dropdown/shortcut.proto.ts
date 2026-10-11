import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownShortcut, type DropdownShortcutProps } from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownShortcutProps>({
  name: 'brutalist-dropdown-shortcut',
  setup(def) {
    const state = asDropdownShortcut();
    def.feedback.style.use(tw('ml-auto text-xs font-medium tracking-widest'));
  },
});
