import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionHeading,
  type AccordionHeadingProps,
  type AccordionHeadingExposes,
} from '@proto.ui/prototypes-base/accordion';
// Opaque source-stage projection. Optical material must use the shared intent contract; no native-blur substitution.
export default definePrototype<AccordionHeadingProps, AccordionHeadingExposes>({
  name: 'liquid-glass-accordion-heading',
  setup(def) {
    asAccordionHeading();
    def.feedback.style.use(tw('block m-0 min-w-0'));
  },
});
