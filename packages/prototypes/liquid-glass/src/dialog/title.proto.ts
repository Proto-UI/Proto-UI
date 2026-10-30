import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogTitle,
  type DialogTitleProps,
  type DialogTitleExposes,
} from '@proto.ui/prototypes-base/dialog';

export default definePrototype<DialogTitleProps, DialogTitleExposes>({
  name: 'liquid-glass-dialog-title',
  setup(def) {
    const behavior = asDialogTitle();
    def.feedback.style.use(tw('text-lg font-semibold'));
  },
});
