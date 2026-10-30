import { definePrototype, tw } from '@proto.ui/core';
import { asSelectContent } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectContentProps, Bootstrap232SelectContentExposes } from './types';

export default definePrototype<Bootstrap232SelectContentProps, Bootstrap232SelectContentExposes>({
  name: 'bootstrap-2-3-2-select-content',
  setup(def) {
    const select = asSelectContent();
    // Keep Base portal, collision, focus, dismissal and zero-duration presence.
    select.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });

    // The custom Select uses the pinned .dropdown-menu box. Viewport is the
    // sole bounded scrollport; Content owns the anchored popup and its chrome.
    // A narrow available region still wins over the historical 160px minimum.
    def.feedback.style.use(
      tw(
        'z-[1000] flex min-w-0 flex-col w-[max(var(--proto-ui-anchor-width),160px)] max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] outline-none rounded-[6px] border border-[rgb(0_0_0/20%)] bg-white bg-clip-padding text-[#333] py-[5px] shadow-[0_5px_10px_rgb(0_0_0/20%)]'
      )
    );
  },
});
