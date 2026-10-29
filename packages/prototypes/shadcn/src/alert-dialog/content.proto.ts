import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogContent,
  type AlertDialogContentExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { AlertDialogContentProps } from './types';
import { setupOverlayDarkRing, setupOverlayPaint } from '../dialog/style';
import { ALERT_PANEL } from './recipes';

export default definePrototype<AlertDialogContentProps, AlertDialogContentExposes>({
  name: 'shadcn-alert-dialog-content',
  setup(def) {
    const behavior = asAlertDialogContent();
    const style = setupOverlayPaint(def, ALERT_PANEL);
    setupOverlayDarkRing(def, style);
    def.feedback.style.use(
      tw(
        'fixed left-[var(--proto-ui-available-region-center-x,50%)] top-[var(--proto-ui-available-region-center-y,50%)] -translate-x-1/2 -translate-y-1/2 w-full max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)] overflow-y-auto grid'
      )
    );
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) =>
        i.feedback.style.use(
          tw('max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]')
        ),
    });
    def.rule({
      when: (w) => w.not(w.state(style).eq('new-york-v4')),
      intent: (i) =>
        i.feedback.style.use(
          tw('max-w-[min(20rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]')
        ),
    });
    // Existing zero-duration retention is preserved. Modern animation completion
    // cannot be claimed until a lawful profile-selectable Transition default exists.
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
