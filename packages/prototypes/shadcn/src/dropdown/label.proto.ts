import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownLabel } from '@proto.ui/prototypes-base/dropdown';
import type { ShadcnDropdownLabelProps } from './types';
export default definePrototype<ShadcnDropdownLabelProps>({
  name: 'shadcn-dropdown-label',
  setup(def) {
    asDropdownLabel();
    // P-SHADCN-DROPDOWN-MENU-LABEL-INSET: family paint only; Base owns naming.
    def.props.define({ inset: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ inset: false });
    def.feedback.style.use(tw('px-1.5 py-1 text-xs font-medium text-muted-foreground'));
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-7')),
    });
  },
});
