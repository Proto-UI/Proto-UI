import type {
  CheckboxGroupRootProps,
  CheckboxGroupRootExposes,
} from '@proto.ui/prototypes-base/checkbox-group';
import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxGroupRoot } from '@proto.ui/prototypes-base/checkbox-group';
export default definePrototype<CheckboxGroupRootProps, CheckboxGroupRootExposes>({
  name: 'bootstrap-2-3-2-checkbox-group-root',
  setup(def) {
    const inherited = asCheckboxGroupRoot();
    def.feedback.style.use(tw('flex min-w-0 flex-col text-foreground text-[14px] leading-[20px]'));
    return inherited.render;
  },
});
