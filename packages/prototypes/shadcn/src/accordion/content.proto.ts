import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionContent,
  type AccordionContentProps,
  type AccordionContentExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionContentProps, AccordionContentExposes>({
  name: 'shadcn-accordion-content',
  setup(def) {
    asAccordionContent();
    def.feedback.style.use(
      tw('block min-w-0 pb-4 text-sm leading-relaxed break-words overflow-x-auto')
    );
  },
});
