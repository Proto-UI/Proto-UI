import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionHeading,
  type AccordionHeadingExposes,
} from '@proto.ui/prototypes-base/accordion';
import type { ShadcnAccordionHeadingProps } from './types';
export default definePrototype<ShadcnAccordionHeadingProps, AccordionHeadingExposes>({
  name: 'shadcn-accordion-heading',
  modules: asAccordionHeading.modules,
  setup(def) {
    const inherited = asAccordionHeading();
    def.feedback.style.use(tw('flex m-0 min-w-0'));
    return inherited.render;
  },
});
