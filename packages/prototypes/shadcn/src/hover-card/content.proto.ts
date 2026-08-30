import { definePrototype, tw } from '@proto.ui/core';
import { asHoverCardContent } from '@proto.ui/prototypes-base/hover-card';
import type { ShadcnHoverCardContentExposes, ShadcnHoverCardContentProps } from './types';

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

    // P-SHADCN-HOVER-CARD-CONTENT-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(
      tw(
        'z-50 w-64 rounded-md border border-border bg-popover p-4 text-sm text-popover-foreground shadow-md outline-none transition-none duration-200'
      )
    );

    // P-SHADCN-HOVER-CARD-CONTENT-OPEN-AND-SIDE-STYLES
    def.rule({
      when: (w) => w.state(open).eq(true),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
    });
    def.rule({
      when: (w) => w.state(open).eq(false),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95')),
    });
    def.rule({
      when: (w) => w.all(w.state(open).eq(true), w.prop('side').eq('bottom')),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-top-2')),
    });
    def.rule({
      when: (w) => w.all(w.state(open).eq(true), w.prop('side').eq('top')),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-bottom-2')),
    });
    def.rule({
      when: (w) => w.all(w.state(open).eq(true), w.prop('side').eq('left')),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-right-2')),
    });
    def.rule({
      when: (w) => w.all(w.state(open).eq(true), w.prop('side').eq('right')),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-left-2')),
    });
  },
});

/** P-SHADCN-HOVER-CARD-CONTENT-DIRECT-ENTRY; parity is bounded by P-SHADCN-HOVER-CARD-CONTENT-COMPATIBILITY-SUBSET. */

export default hoverCardContent;
