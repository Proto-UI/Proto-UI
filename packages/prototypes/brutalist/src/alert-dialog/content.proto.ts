import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogContent,
  type AlertDialogContentProps,
  type AlertDialogContentExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogContentProps, AlertDialogContentExposes>({
  name: 'brutalist-alert-dialog-content',
  setup(def) {
    const behavior = asAlertDialogContent();
    def.feedback.style.use(
      tw(
        'rounded-none border-2 border-foreground bg-background text-foreground shadow-[4px_4px_0_0_var(--pui-foreground)] p-4 fixed left-[var(--proto-ui-available-region-center-x,50%)] top-[var(--proto-ui-available-region-center-y,50%)] -translate-x-1/2 -translate-y-1/2 w-full max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))] max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)] overflow-y-auto grid gap-4'
      )
    );
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
