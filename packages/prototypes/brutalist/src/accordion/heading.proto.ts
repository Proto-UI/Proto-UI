import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionHeading,
  type AccordionHeadingProps,
  type AccordionHeadingExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionHeadingProps, AccordionHeadingExposes>({
  name: 'brutalist-accordion-heading',
  modules: asAccordionHeading.modules,
  setup(def) {
    const inherited = asAccordionHeading();
    def.feedback.style.use(tw('block m-0 min-w-0'));
    return inherited.render;
  },
});
