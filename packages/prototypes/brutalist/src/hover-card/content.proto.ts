import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import { asHoverCardContent } from '@proto.ui/prototypes-base/hover-card';
import type { BrutalistHoverCardContentExposes, BrutalistHoverCardContentProps } from './types';

const hoverCardContent = definePrototype<
  BrutalistHoverCardContentProps,
  BrutalistHoverCardContentExposes
>({
  name: 'brutalist-hover-card-content',
  setup(def) {
    // P-BRUTALIST-HOVER-CARD-CONTENT-BASE-INHERITANCE
    const hoverCard = asHoverCardContent();
    // P-BRUTALIST-HOVER-CARD-CONTENT-TRANSITION
    hoverCard.asTransition.configure({ enterDuration: 200, leaveDuration: 200 });
    const { open } = hoverCard.stateHandles;

    // P-BRUTALIST-HOVER-CARD-CONTENT-VISUAL-GRAMMAR
    def.feedback.style.use(
      tw(
        `w-64 p-4 text-sm leading-6 outline-none transition-none duration-200 ${BRUTALIST_PANEL_TOKENS}`
      )
    );

    // P-BRUTALIST-HOVER-CARD-CONTENT-TRANSITION
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

/** P-BRUTALIST-HOVER-CARD-CONTENT-ENTRY */

export default hoverCardContent;
