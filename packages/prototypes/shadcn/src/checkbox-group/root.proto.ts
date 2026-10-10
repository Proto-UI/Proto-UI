import type {
  CheckboxGroupRootProps,
  CheckboxGroupRootExposes,
} from '@proto.ui/prototypes-base/checkbox-group';
import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxGroupRoot } from '@proto.ui/prototypes-base/checkbox-group';
export default definePrototype<CheckboxGroupRootProps, CheckboxGroupRootExposes>({
  name: 'shadcn-checkbox-group-root',
  setup(def) {
    const inherited = asCheckboxGroupRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-3 text-foreground'));
    return inherited.render;
  },
});
