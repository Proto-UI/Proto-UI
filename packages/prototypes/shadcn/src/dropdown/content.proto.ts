import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownContent } from '@proto.ui/prototypes-base/dropdown';
import type { ShadcnDropdownContentExposes, ShadcnDropdownContentProps } from './types';

const dropdownContent = definePrototype<ShadcnDropdownContentProps, ShadcnDropdownContentExposes>({
  name: 'shadcn-dropdown-content',
  setup(def) {
    // P-SHADCN-DROPDOWN-MENU-CONTENT-BASE-INHERITANCE,
    // P-SHADCN-DROPDOWN-MENU-CONTENT-CURRENT-BASE-DEVIATIONS
    const dropdown = asDropdownContent();
    // P-SHADCN-DROPDOWN-MENU-CONTENT-TRANSITION
    dropdown.asTransition.configure({ enterDuration: 100, leaveDuration: 100 });
    const { open } = dropdown.stateHandles;
    const { transitionState } = dropdown.asTransition;

    // P-SHADCN-DROPDOWN-MENU-CONTENT-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(
      tw(
        'z-50 max-h-[var(--proto-ui-available-height)] min-w-32 overflow-x-hidden overflow-y-auto rounded-lg ring-1 ring-foreground/10 bg-popover p-1 text-popover-foreground shadow-md outline-none transition-none duration-100'
      )
    );
    // P-SHADCN-DROPDOWN-MENU-CONTENT-OPEN-AND-SIDE-STYLES
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

/** P-SHADCN-DROPDOWN-MENU-CONTENT-DIRECT-ENTRY; parity is bounded by P-SHADCN-DROPDOWN-MENU-CONTENT-COMPATIBILITY-SUBSET. */

export default dropdownContent;
