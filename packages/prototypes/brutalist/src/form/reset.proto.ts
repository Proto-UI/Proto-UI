import { definePrototype, tw } from '@proto.ui/core';
import { asFormReset } from '@proto.ui/prototypes-base/form';
export default definePrototype({
  name: 'brutalist-form-reset',
  setup(def) {
    const inherited = asFormReset();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-10 items-center justify-center rounded-none border-2 border border-border bg-primary px-4 py-2 text-primary-foreground outline-none'
      )
    );
    return inherited.render;
  },
});
