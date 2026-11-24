import type { FormRootProps, FormRootExposes } from '@proto.ui/prototypes-base/form';
import { definePrototype, tw } from '@proto.ui/core';
import { asFormRoot } from '@proto.ui/prototypes-base/form';

export default definePrototype<FormRootProps, FormRootExposes>({
  name: 'brutalist-form-root',
  modules: asFormRoot.modules,
  setup(def) {
    const inherited = asFormRoot();
    def.feedback.style.use(
      tw('flex w-full min-w-0 flex-col gap-5 font-sans font-medium text-foreground')
    );
    return inherited.render;
  },
});
