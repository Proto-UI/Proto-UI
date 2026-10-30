import type { FormRootExposes } from '@proto.ui/prototypes-base/form';
import { definePrototype, tw } from '@proto.ui/core';
import { asFormRoot } from '@proto.ui/prototypes-base/form';
import { setupShadcnStyleSelection } from '../style-scope';
import type { ShadcnFormRootProps } from './types';
export default definePrototype<ShadcnFormRootProps, FormRootExposes>({
  name: 'shadcn-form-root',
  modules: asFormRoot.modules,
  setup(def) {
    const inherited = asFormRoot();
    // Proto Form policy/layout, not react-hook-form FormProvider API parity.
    setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-3 text-foreground'));
    return inherited.render;
  },
});
