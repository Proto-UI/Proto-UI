import { definePrototype, tw } from '@proto.ui/core';
import { asSelectItemText } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectItemTextProps } from './types';

// Long/translated option text keeps wrapping inside the Item row; the
// selection indicator stays on Item.
export default definePrototype<Bootstrap232SelectItemTextProps>({
  name: 'bootstrap-2-3-2-select-item-text',
  setup(def) {
    const inherited = asSelectItemText();
    def.feedback.style.use(tw('min-w-0 whitespace-normal wrap-anywhere'));
    return inherited.render;
  },
});
