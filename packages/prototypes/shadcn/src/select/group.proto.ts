import { definePrototype } from '@proto.ui/core';
import { asSelectGroup } from '@proto.ui/prototypes-base/select';

export default definePrototype({
  name: 'shadcn-select-group',
  setup() {
    asSelectGroup();
  },
});
