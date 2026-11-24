import type {
  NumberFieldRootProps,
  NumberFieldRootExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldRoot } from '@proto.ui/prototypes-base/number-field';
export default definePrototype<NumberFieldRootProps, NumberFieldRootExposes>({
  name: 'liquid-glass-number-field-root',
  modules: asNumberFieldRoot.modules,
  setup(def) {
    const inherited = asNumberFieldRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 items-center gap-2 font-sans text-foreground'));
    return inherited.render;
  },
});
