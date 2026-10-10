import type { FormActionProps } from '@proto.ui/prototypes-base/form';
import { definePrototype, tw } from '@proto.ui/core';
import { asFormSubmit } from '@proto.ui/prototypes-base/form';
export default definePrototype<FormActionProps, Record<string, unknown>>({
  name: 'bootstrap-2-3-2-form-submit',
  setup(def) {
    const inherited = asFormSubmit();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-8 items-center justify-center rounded-[4px] border border-border bg-primary px-4 py-2 text-primary-foreground outline-none'
      )
    );
    return inherited.render;
  },
});
