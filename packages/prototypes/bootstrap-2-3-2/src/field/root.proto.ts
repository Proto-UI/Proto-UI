import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldRoot,
  type FieldRootProps,
  type FieldRootExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldRootProps, FieldRootExposes>({
  name: 'bootstrap-2-3-2-field-root',
  setup(def) {
    const inherited = asFieldRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-1.5 text-foreground'));
    return inherited.render;
  },
});
