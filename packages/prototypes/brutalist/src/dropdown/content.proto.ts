import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import { asDropdownContent } from '@proto.ui/prototypes-base/dropdown';
import type { BrutalistDropdownContentExposes, BrutalistDropdownContentProps } from './types';

const dropdownContent = definePrototype<
  BrutalistDropdownContentProps,
  BrutalistDropdownContentExposes
>({
  name: 'brutalist-dropdown-content',
  setup(def) {
    // P-BRUTALIST-DROPDOWN-MENU-CONTENT-BASE-INHERITANCE
    const dropdown = asDropdownContent();
    // P-BRUTALIST-DROPDOWN-MENU-CONTENT-ANCHOR-TRANSFORM
    // The Brutalist trigger carries decorative hover-lift / press transforms;
    // anchored menus track the trigger's layout position instead.
    def.props.setDefaults({ excludeAnchorTranslation: true });
    // P-BRUTALIST-DROPDOWN-MENU-CONTENT-TRANSITION
    dropdown.asTransition.configure({ enterDuration: 150, leaveDuration: 100 });
    const { open } = dropdown.stateHandles;
    const { transitionState } = dropdown.asTransition;

    // P-BRUTALIST-DROPDOWN-MENU-CONTENT-VISUAL-GRAMMAR
    def.feedback.style.use(
      tw(
        `z-50 max-h-[var(--proto-ui-available-height)] min-w-32 overflow-x-hidden overflow-y-auto p-1 outline-none transition-none duration-150 ${BRUTALIST_PANEL_TOKENS}`
      )
    );
    // P-BRUTALIST-DROPDOWN-MENU-CONTENT-TRANSITION
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

/** P-BRUTALIST-DROPDOWN-MENU-CONTENT-ENTRY */

export default dropdownContent;
