import { definePrototype, tw } from '@proto.ui/core';
import { asComboboxRoot } from '@proto.ui/prototypes-base/combobox';
import type { ComboboxRootProps, ComboboxRootExposes } from './types';
import { setupShadcnStyleScope } from '../style-scope';
export default definePrototype<ComboboxRootProps, ComboboxRootExposes>({
  name: 'shadcn-combobox-root',
  modules: asComboboxRoot.modules,
  setup(def) {
    asComboboxRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('relative flex min-w-0 w-full max-w-md flex-wrap gap-2'));
  },
});
