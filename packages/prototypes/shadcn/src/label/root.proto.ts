import { definePrototype, tw } from '@proto.ui/core';
import {
  asLabelRoot,
  type LabelRootProps,
  type LabelRootExposes,
} from '@proto.ui/prototypes-base/label';
export default definePrototype<LabelRootProps, LabelRootExposes>({
  name: 'shadcn-label-root',
  setup(def) {
    asLabelRoot();
    def.feedback.style.use(
      tw('flex items-center gap-2 text-sm font-medium leading-none text-foreground')
    );
  },
});
