import { definePrototype } from '@proto.ui/core';
import { asSelectItemText } from '@proto.ui/prototypes-base/select';

export default definePrototype({
  name: 'shadcn-select-item-text',
  setup() {
    asSelectItemText();
  },
});
