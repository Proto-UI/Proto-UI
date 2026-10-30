import { definePrototype, tw } from '@proto.ui/core';
import { asHoverCardContent } from '@proto.ui/prototypes-base/hover-card';
import type { ShadcnHoverCardContentExposes, ShadcnHoverCardContentProps } from './types';
import { setupOverlayDarkRing, setupOverlayPaint } from '../dialog/style';
import { HOVER_CARD_PANEL } from './recipes';
import { setupPopupMotion } from '../popover/motion';

const hoverCardContent = definePrototype<
  ShadcnHoverCardContentProps,
  ShadcnHoverCardContentExposes
>({
  name: 'shadcn-hover-card-content',
  setup(def) {
    // P-SHADCN-HOVER-CARD-CONTENT-BASE-INHERITANCE,
    // P-SHADCN-HOVER-CARD-CONTENT-CURRENT-BASE-DEVIATIONS
    const hoverCard = asHoverCardContent();
    // P-SHADCN-HOVER-CARD-CONTENT-TRANSITION
    hoverCard.asTransition.configure({ enterDuration: 200, leaveDuration: 200 });
    const { open } = hoverCard.stateHandles;
    const style = setupOverlayPaint(def, HOVER_CARD_PANEL);
    setupOverlayDarkRing(def, style);

    // P-SHADCN-HOVER-CARD-CONTENT-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(tw('z-50 outline-none'));

    setupPopupMotion(def, open);
  },
});

/** P-SHADCN-HOVER-CARD-CONTENT-DIRECT-ENTRY; parity is bounded by P-SHADCN-HOVER-CARD-CONTENT-COMPATIBILITY-SUBSET. */

export default hoverCardContent;
