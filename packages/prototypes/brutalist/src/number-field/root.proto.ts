import type {
  NumberFieldRootProps,
  NumberFieldRootExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldRoot } from '@proto.ui/prototypes-base/number-field';
export default definePrototype<NumberFieldRootProps, NumberFieldRootExposes>({
  name: 'brutalist-number-field-root',
  setup(def) {
    const inherited = asNumberFieldRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-3 text-foreground'));
    return inherited.render;
  },
});
