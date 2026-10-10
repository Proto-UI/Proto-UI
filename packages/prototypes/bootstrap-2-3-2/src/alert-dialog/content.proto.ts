import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogContent,
  type AlertDialogContentProps,
  type AlertDialogContentExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogContentProps, AlertDialogContentExposes>({
  name: 'bootstrap-2-3-2-alert-dialog-content',
  setup(def) {
    const behavior = asAlertDialogContent();
    def.feedback.style.use(
      tw(
        'rounded-md border border-border bg-background text-foreground shadow-lg p-4 fixed left-[var(--proto-ui-available-region-center-x,50%)] top-[var(--proto-ui-available-region-center-y,50%)] -translate-x-1/2 -translate-y-1/2 w-full max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))] max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)] overflow-y-auto grid gap-4'
      )
    );
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
