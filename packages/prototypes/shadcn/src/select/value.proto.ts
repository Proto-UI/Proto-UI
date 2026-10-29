import { setupSelectStyle } from './style';
import { definePrototype, tw } from '@proto.ui/core';
import { asSelectValue } from '@proto.ui/prototypes-base/select';
import type { ShadcnSelectValueExposes, ShadcnSelectValueProps } from './types';

const selectValue = definePrototype<ShadcnSelectValueProps, ShadcnSelectValueExposes>({
  name: 'shadcn-select-value',
  setup(def) {
    const style = setupSelectStyle(def);
    def.feedback.style.use(tw('line-clamp-1 flex items-center'));
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('gap-2')),
    });
    def.rule({
      when: (w) => w.not(w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('flex-1 text-left gap-1.5')),
    });
    // P-SHADCN-SELECT-VALUE-BASE-INHERITANCE,
    // P-SHADCN-SELECT-VALUE-CURRENT-BASE-DEVIATIONS,
    // P-SHADCN-SELECT-VALUE-DISPLAY-RENDER
    const value = asSelectValue().stateHandles;
    if (!value) throw new Error('[shadcn-select-value] Select Value must project displayValue.');
    return () => (value.displayValue.get() ? [value.displayValue.get()] : null);
  },
});

/** P-SHADCN-SELECT-VALUE-DIRECT-ENTRY; parity is bounded by P-SHADCN-SELECT-VALUE-COMPATIBILITY-SUBSET. */

export default selectValue;
