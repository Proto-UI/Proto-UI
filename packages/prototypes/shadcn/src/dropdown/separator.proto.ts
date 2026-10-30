import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownSeparator,
  type DropdownSeparatorProps,
} from '@proto.ui/prototypes-base/dropdown';
import { SHADCN_STYLE_IDS, type ShadcnStyleProps } from '../style-scope';
import { MENU_PROFILES, setupMenuStyle } from './visual';
export default definePrototype<DropdownSeparatorProps & ShadcnStyleProps>({
  name: 'shadcn-dropdown-separator',
  modules: asDropdownSeparator.modules,
  setup(def) {
    asDropdownSeparator();
    const style = setupMenuStyle(def);
    def.feedback.style.use(tw('h-px'));
    for (const id of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(id),
        intent: (i) => i.feedback.style.use(tw(MENU_PROFILES[`${id}-separator`])),
      });
    }
  },
});
