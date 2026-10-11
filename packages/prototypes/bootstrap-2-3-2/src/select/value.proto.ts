import { definePrototype, tw } from '@proto.ui/core';
import { asSelectValue } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectValueProps, Bootstrap232SelectValueExposes } from './types';

export default definePrototype<Bootstrap232SelectValueProps, Bootstrap232SelectValueExposes>({
  name: 'bootstrap-2-3-2-select-value',
  setup(def) {
    const state = asSelectValue().stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-select-value] Required Base state handles are missing.');
    const { displayValue } = state;
    // Grow with long/translated labels; the enclosing Trigger owns pointer hits.
    def.feedback.style.use(tw('min-w-0 flex-1 whitespace-normal wrap-anywhere text-start'));
    return () => (displayValue.get() ? [displayValue.get()] : null);
  },
});
