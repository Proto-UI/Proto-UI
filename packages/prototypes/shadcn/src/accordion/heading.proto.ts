import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionHeading,
  type AccordionHeadingProps,
  type AccordionHeadingExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionHeadingProps, AccordionHeadingExposes>({
  name: 'shadcn-accordion-heading',
  setup(def) {
    asAccordionHeading();
    def.feedback.style.use(tw('block m-0 min-w-0'));
  },
});
