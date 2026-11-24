import { definePrototype, tw } from '@proto.ui/core';
import {
  asLabelRoot,
  type LabelRootProps,
  type LabelRootExposes,
} from '@proto.ui/prototypes-base/label';

export default definePrototype<LabelRootProps, LabelRootExposes>({
  name: 'bootstrap-2-3-2-label-root',
  modules: asLabelRoot.modules,
  setup(def) {
    const inherited = asLabelRoot();
    // Classic Bootstrap 2.3.2 typography (14px/20px Helvetica Neue, normal weight)
    // without unconditional bottom margin so inline choice rows stay vertically aligned.
    def.feedback.style.use(
      tw(
        'inline-flex w-fit max-w-full items-center gap-2 font-sans text-[14px] font-normal leading-[20px] text-start break-words text-foreground'
      )
    );
    return inherited.render;
  },
});
