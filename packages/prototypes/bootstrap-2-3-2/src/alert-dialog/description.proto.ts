import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogDescription,
  type AlertDialogDescriptionProps,
  type AlertDialogDescriptionExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogDescriptionProps, AlertDialogDescriptionExposes>({
  name: 'bootstrap-2-3-2-alert-dialog-description',
  modules: asAlertDialogDescription.modules,
  setup(def) {
    const behavior = asAlertDialogDescription();
    // Existing Description carries .modal-body copy and its 15px inset.
    def.feedback.style.use(
      tw(
        'relative overflow-y-auto max-h-[400px] p-[15px] text-[14px] leading-[20px] text-foreground'
      )
    );
    return behavior.render;
  },
});
