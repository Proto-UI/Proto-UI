import { definePrototype, tw } from '@proto.ui/core';
import { asSelectContent } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectContentProps, Bootstrap232SelectContentExposes } from './types';

export default definePrototype<Bootstrap232SelectContentProps, Bootstrap232SelectContentExposes>({
  name: 'bootstrap-2-3-2-select-content',
  setup(def) {
    const select = asSelectContent();
    // Keep Base portal, collision, focus, dismissal and zero-duration presence.
    // Space inside the scrollport keeps item outlines from being clipped.
    select.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });

    def.feedback.style.use(
      tw(
        'z-50 min-w-0 w-[var(--proto-ui-anchor-width)] max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-x-hidden overflow-y-auto outline-none rounded-[6px] border border-border bg-background text-foreground py-[0.3125rem] shadow-[0_5px_10px_rgb(0_0_0/20%)]'
      )
    );
  },
});
