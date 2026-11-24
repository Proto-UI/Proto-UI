import type {
  NumberFieldRootProps,
  NumberFieldRootExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldRoot } from '@proto.ui/prototypes-base/number-field';
export default definePrototype<NumberFieldRootProps, NumberFieldRootExposes>({
  name: 'bootstrap-2-3-2-number-field-root',
  modules: asNumberFieldRoot.modules,
  setup(def) {
    const inherited = asNumberFieldRoot();
    // Numeric composition is a Proto extension, not a Bootstrap 2.3.2 plugin.
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 flex-wrap items-center gap-[4px] font-sans text-foreground text-[14px] leading-[20px]'
      )
    );
    return inherited.render;
  },
});
