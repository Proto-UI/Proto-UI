import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownLabel } from '@proto.ui/prototypes-base/dropdown';
import type { BrutalistDropdownLabelProps } from './types';

export default definePrototype<BrutalistDropdownLabelProps>({
  name: 'brutalist-dropdown-label',
  modules: asDropdownLabel.modules,
  setup(def) {
    const behavior = asDropdownLabel();
    def.props.define({
      inset: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ inset: false });
    def.feedback.style.use(tw('px-2 py-1.5 text-sm font-heading font-bold'));
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-8')),
    });
    return behavior.render;
  },
});
