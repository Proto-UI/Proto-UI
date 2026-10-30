import type { FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype } from '@proto.ui/core';
import { asFieldsetDescription } from '@proto.ui/prototypes-base/fieldset';
import type { ShadcnFieldsetPartProps } from './types';
import { setupFieldTextVisual } from '../field/visual';
export default definePrototype<ShadcnFieldsetPartProps, FieldsetRootExposes>({
  name: 'shadcn-fieldset-description',
  modules: asFieldsetDescription.modules,
  setup(def) {
    const inherited = asFieldsetDescription();
    setupFieldTextVisual(def, 'description');
    return inherited.render;
  },
});
