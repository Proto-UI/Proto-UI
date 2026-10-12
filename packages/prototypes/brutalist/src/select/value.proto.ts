import { definePrototype, tw } from '@proto.ui/core';
import { asSelectValue } from '@proto.ui/prototypes-base/select';
import type { BrutalistSelectValueExposes, BrutalistSelectValueProps } from './types';

const selectValue = definePrototype<BrutalistSelectValueProps, BrutalistSelectValueExposes>({
  name: 'brutalist-select-value',
  setup(def) {
    def.feedback.style.use(tw('flex flex-1 items-center gap-2 text-left'));
    // P-BRUTALIST-SELECT-VALUE-BASE-INHERITANCE: inherit Base Select Value displayValue state once.
    const value = asSelectValue().stateHandles;
    if (!value) throw new Error('[brutalist-select-value] Select Value must project displayValue.');
    // P-BRUTALIST-SELECT-VALUE-DISPLAY-RENDER: render displayValue as content, or null when empty.
    return () => (value.displayValue.get() ? [value.displayValue.get()] : null);
  },
});

// P-BRUTALIST-SELECT-VALUE-ENTRY: `brutalist-select-value` is the only public Select value entry in this slice.

export default selectValue;
