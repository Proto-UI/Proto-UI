import { definePrototype, tw } from '@proto.ui/core';
import { asSelectLabel } from '@proto.ui/prototypes-base/select';

export default definePrototype({
  name: 'shadcn-select-label',
  setup(def) {
    asSelectLabel();
    def.feedback.style.use(tw('px-2 py-1.5 text-xs text-muted-foreground'));
  },
});
