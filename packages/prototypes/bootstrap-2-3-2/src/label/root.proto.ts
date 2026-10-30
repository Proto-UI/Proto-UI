import { definePrototype, tw } from '@proto.ui/core';
import {
  asLabelRoot,
  type LabelRootProps,
  type LabelRootExposes,
} from '@proto.ui/prototypes-base/label';

export default definePrototype<LabelRootProps, LabelRootExposes>({
  name: 'bootstrap-2-3-2-label-root',
  setup(def) {
    const inherited = asLabelRoot();
    def.feedback.style.use(
      tw('block mb-[5px] text-[14px] font-normal leading-[20px] text-foreground')
    );
    return inherited.render;
  },
});
