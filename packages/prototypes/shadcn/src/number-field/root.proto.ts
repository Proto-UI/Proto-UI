import type { NumberFieldRootExposes } from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldRoot } from '@proto.ui/prototypes-base/number-field';
import { setupShadcnStyleSelection } from '../style-scope';
import type { ShadcnNumberFieldRootProps } from './types';
export default definePrototype<ShadcnNumberFieldRootProps, NumberFieldRootExposes>({
  name: 'shadcn-number-field-root',
  modules: asNumberFieldRoot.modules,
  setup(def) {
    const inherited = asNumberFieldRoot();
    // Proto composition layout has no claimed upstream NumberField equivalent.
    setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-3 text-foreground'));
    return inherited.render;
  },
});
