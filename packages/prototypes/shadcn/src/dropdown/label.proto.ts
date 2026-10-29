import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownLabel } from '@proto.ui/prototypes-base/dropdown';
import type { ShadcnDropdownLabelProps } from './types';
import { SHADCN_STYLE_IDS } from '../style-scope';
import { MENU_PROFILES, setupMenuStyle } from './visual';
export default definePrototype<ShadcnDropdownLabelProps>({
  name: 'shadcn-dropdown-label',
  modules: asDropdownLabel.modules,
  setup(def) {
    asDropdownLabel();
    // P-SHADCN-DROPDOWN-MENU-LABEL-INSET: family paint only; Base owns naming.
    def.props.define({ inset: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ inset: false });
    const style = setupMenuStyle(def);
    for (const id of SHADCN_STYLE_IDS) {
      const recipe = MENU_PROFILES[id];
      def.rule({
        when: (w) => w.state(style).eq(id),
        intent: (i) => i.feedback.style.use(tw(recipe.label, recipe.right)),
      });
      // Physical left remains physical left in RTL, as in the retained source.
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.prop('inset').eq(false)),
        intent: (i) => i.feedback.style.use(tw(recipe.left)),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.prop('inset').eq(true)),
        intent: (i) => i.feedback.style.use(tw(recipe.inset)),
      });
    }
  },
});
