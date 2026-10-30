import type { CheckboxGroupRootExposes } from '@proto.ui/prototypes-base/checkbox-group';
import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxGroupRoot } from '@proto.ui/prototypes-base/checkbox-group';
import { setupShadcnStyleScope } from '../style-scope';
import type { ShadcnCheckboxGroupRootProps } from './types';
export default definePrototype<ShadcnCheckboxGroupRootProps, CheckboxGroupRootExposes>({
  name: 'shadcn-checkbox-group-root',
  setup(def) {
    const inherited = asCheckboxGroupRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-3 text-foreground'));
    return inherited.render;
  },
});
