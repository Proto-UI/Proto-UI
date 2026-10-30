import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionHeading,
  type AccordionHeadingProps,
  type AccordionHeadingExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionHeadingProps, AccordionHeadingExposes>({
  name: 'bootstrap-2-3-2-accordion-heading',
  setup(def) {
    const inherited = asAccordionHeading();
    def.feedback.style.use(tw('block m-0 min-w-0 border-b-0'));
    return inherited.render;
  },
});
