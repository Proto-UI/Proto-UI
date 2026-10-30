import type { FormFieldProps, FormFieldExposes } from '@proto.ui/prototypes-base/form';
import { definePrototype, tw } from '@proto.ui/core';
import { asFormField } from '@proto.ui/prototypes-base/form';
export default definePrototype<FormFieldProps, FormFieldExposes>({
  name: 'bootstrap-2-3-2-form-field',
  setup(def) {
    const inherited = asFormField();
    const field = inherited.getAsHookHandle!('as-field-root');
    if (!field?.stateHandles)
      throw new Error('[bootstrap-2-3-2-form-field] Base Field facts required.');
    def.feedback.style.use(
      tw('block min-w-0 mb-[10px] text-foreground text-[14px] leading-[20px]')
    );
    def.rule({
      when: (w) => w.state(field.stateHandles!.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-destructive')),
    });
    return inherited.render;
  },
});
