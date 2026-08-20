import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import { asSelectContent } from '@proto.ui/prototypes-base/select';
import type { BrutalistSelectContentExposes, BrutalistSelectContentProps } from './types';

const selectContent = definePrototype<BrutalistSelectContentProps, BrutalistSelectContentExposes>({
  name: 'brutalist-select-content',
  setup(def) {
    // P-BRUTALIST-SELECT-CONTENT-BASE-INHERITANCE: inherit Base Select Content open/transitionState/side states once.
    const select = asSelectContent();
    // P-BRUTALIST-SELECT-CONTENT-TRANSITION: enter 150ms / leave 100ms; side slide-in + fade zoom enter/leave.
    select.asTransition.configure({ enterDuration: 150, leaveDuration: 100 });
    const { open } = select.stateHandles;
    const { transitionState } = select.asTransition;

    // P-BRUTALIST-SELECT-CONTENT-VISUAL-GRAMMAR: anchored hard-shadowed square listbox panel (BRUTALIST_PANEL_TOKENS).
    def.feedback.style.use(
      tw(
        `relative z-50 w-[var(--proto-ui-anchor-width)] min-w-[var(--proto-ui-anchor-width)] max-h-[var(--proto-ui-available-height)] overflow-x-hidden overflow-y-auto p-1 outline-none transition-none duration-150 ${BRUTALIST_PANEL_TOKENS}`
      )
    );
    // P-BRUTALIST-SELECT-CONTENT-TRANSITION (enter fading zoom) and side-based slide-in rules below.
    def.rule({
      when: (w) =>
        w.any(w.state(transitionState).eq('entering'), w.state(transitionState).eq('entered')),
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

// P-BRUTALIST-SELECT-CONTENT-ENTRY: `brutalist-select-content` is the only public Select content entry in this slice.

export default selectContent;
