import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionHeading,
  ACCORDION_ITEM_FAMILY,
  ACCORDION_FAMILY,
  type AccordionHeadingProps,
  type AccordionHeadingExposes,
} from '@proto.ui/prototypes-base/accordion';
// Opaque source-stage projection. Optical material must use the shared intent contract; no native-blur substitution.
export default definePrototype<AccordionHeadingProps, AccordionHeadingExposes>({
  name: 'liquid-glass-accordion-heading',
  setup(def) {
    asAccordionHeading();
    def.feedback.style.use(tw('block m-0 min-w-0'));
    const reservation = def.feedback.material.reserve({
      family: ACCORDION_ITEM_FAMILY,
      targetRole: 'trigger',
      inlineSizeFrom: { family: ACCORDION_FAMILY, role: 'root' },
      outlineFrom: { family: ACCORDION_ITEM_FAMILY, role: 'root' },
    });
    return (r) => r.paintReservation(reservation, r.slot());
  },
});
