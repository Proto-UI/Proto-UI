import { definePrototype, tw } from '@proto.ui/core';
import { asPopoverContent, type PopoverContentExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverContentProps } from './types';
import { setupOverlayDarkRing, setupOverlayPaint } from '../dialog/style';
import { POPOVER_PANEL } from './recipes';
import { setupPopupMotion } from './motion';

export default definePrototype<PopoverContentProps, PopoverContentExposes>({
  name: 'shadcn-popover-content',
  setup(def) {
    const behavior = asPopoverContent();
    const style = setupOverlayPaint(def, POPOVER_PANEL, 'nova');
    setupOverlayDarkRing(def, style);
    def.feedback.style.use(
      tw(
        'z-50 w-72 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto outline-none'
      )
    );
    const { open } = behavior.stateHandles;
    setupPopupMotion(def, open);
    // The existing zero-duration default remains a retention-policy gap; CSS
    // animation tokens alone do not establish a retained native leave frame.
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
