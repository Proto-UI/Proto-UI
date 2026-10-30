import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogDescription,
  type DialogDescriptionProps,
  type DialogDescriptionExposes,
} from '@proto.ui/prototypes-base/dialog';

// Upstream modal body copy runs at @baseFontSize/@baseLineHeight = 14px/20px
// (twbs/bootstrap@b4c4072 less/variables.less, less/modals.less .modal-body).
export default definePrototype<DialogDescriptionProps, DialogDescriptionExposes>({
  name: 'bootstrap-2-3-2-dialog-description',
  setup(def) {
    asDialogDescription();
    def.feedback.style.use(tw('text-[14px] leading-[20px] text-foreground'));
  },
});
