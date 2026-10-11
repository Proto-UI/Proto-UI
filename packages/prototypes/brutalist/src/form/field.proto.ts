import type { FormFieldProps, FormFieldExposes } from '@proto.ui/prototypes-base/form';
import { definePrototype, tw } from '@proto.ui/core';
import { asFormField } from '@proto.ui/prototypes-base/form';
export default definePrototype<FormFieldProps, FormFieldExposes>({
  name: 'brutalist-form-field',
  setup(def) {
    const inherited = asFormField();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-2'));
    const field = inherited.getAsHookHandle?.('as-field-root');
    if (!field) throw new Error('[form-field] Base FieldRoot handle required.');
    // The existing Field owner supplies invalidity; the composed Label inherits its ink.
    def.rule({
      when: (w) => w.state(field.stateHandles!.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-destructive-ink')),
    });
    return inherited.render;
  },
});
