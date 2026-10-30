import { definePrototype, tw } from '@proto.ui/core';
import { asSelectValue } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectValueProps, Bootstrap232SelectValueExposes } from './types';

export default definePrototype<Bootstrap232SelectValueProps, Bootstrap232SelectValueExposes>({
  name: 'bootstrap-2-3-2-select-value',
  setup(def) {
    const inherited = asSelectValue();
    // Grow with long/translated labels; the enclosing Trigger owns pointer hits.
    def.feedback.style.use(tw('min-w-0 flex-1 whitespace-normal wrap-anywhere text-start'));
    return inherited.render;
  },
});
