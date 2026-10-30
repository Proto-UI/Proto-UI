import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogTitle,
  type AlertDialogTitleProps,
  type AlertDialogTitleExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogTitleProps, AlertDialogTitleExposes>({
  name: 'bootstrap-2-3-2-alert-dialog-title',
  modules: asAlertDialogTitle.modules,
  setup(def) {
    const behavior = asAlertDialogTitle();
    // Project .modal-header and its h3 onto the existing heading owner. No
    // extra Header semantic part or descendant selector is introduced.
    def.feedback.style.use(
      tw('m-0 px-[15px] py-[9px] border-b border-[#eee] text-[24.5px] font-bold leading-[30px]')
    );
    return behavior.render;
  },
});
