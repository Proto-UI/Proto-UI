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
    def.feedback.style.use(tw('text-sm font-medium leading-none text-foreground'));
  },
});
