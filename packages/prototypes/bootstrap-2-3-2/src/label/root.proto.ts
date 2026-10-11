import { definePrototype, tw } from '@proto.ui/core';
import {
  asLabelRoot,
  type LabelRootProps,
  type LabelRootExposes,
} from '@proto.ui/prototypes-base/label';

export default definePrototype<LabelRootProps, LabelRootExposes>({
  name: 'bootstrap-2-3-2-label-root',
  setup(def) {
    asLabelRoot();
    def.feedback.style.use(
      tw('block mb-[0.3125rem] text-sm font-normal leading-5 text-foreground')
    );
  },
});
