import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogTitle,
  type DialogTitleProps,
  type DialogTitleExposes,
} from '@proto.ui/prototypes-base/dialog';

// Upstream .modal-header h3: margin 0, line-height 30px, heading weight bold
// (twbs/bootstrap@b4c4072 less/modals.less, less/type.less h3 @baseFontSize*1.75).
export default definePrototype<DialogTitleProps, DialogTitleExposes>({
  name: 'bootstrap-2-3-2-dialog-title',
  setup(def) {
    asDialogTitle();
    def.feedback.style.use(tw('m-0 text-[24.5px] font-bold leading-[30px]'));
  },
});
