import { definePrototype, tw } from '@proto.ui/core';
import { asSelectSeparator } from '@proto.ui/prototypes-base/select';

export default definePrototype({
  name: 'shadcn-select-separator',
  setup(def) {
    asSelectSeparator();
    def.feedback.style.use(tw('pointer-events-none -mx-1 my-1 h-px bg-border'));
    // The caller owns rendering; hooks inherit declarations, not their renderer.
    return () => null;
  },
});
