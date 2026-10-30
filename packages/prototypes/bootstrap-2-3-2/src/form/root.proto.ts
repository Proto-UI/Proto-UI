import type { FormRootProps, FormRootExposes } from '@proto.ui/prototypes-base/form';
import { definePrototype, tw } from '@proto.ui/core';
import { asFormRoot } from '@proto.ui/prototypes-base/form';
export default definePrototype<FormRootProps, FormRootExposes>({
  name: 'bootstrap-2-3-2-form-root',
  setup(def) {
    const inherited = asFormRoot();
    def.feedback.style.use(
      tw('block min-w-0 m-0 mb-[20px] text-foreground text-[14px] leading-[20px]')
    );
    return inherited.render;
  },
});
