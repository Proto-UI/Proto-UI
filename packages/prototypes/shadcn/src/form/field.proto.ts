import type { FormFieldProps, FormFieldExposes } from '@proto.ui/prototypes-base/form';
import { definePrototype, tw } from '@proto.ui/core';
import { asFormField } from '@proto.ui/prototypes-base/form';
export default definePrototype<FormFieldProps, FormFieldExposes>({
  name: 'shadcn-form-field',
  setup(def) {
    const inherited = asFormField();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-2'));
    return inherited.render;
  },
});
