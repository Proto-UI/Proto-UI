import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionContent,
  type AccordionContentProps,
  type AccordionContentExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionContentProps, AccordionContentExposes>({
  name: 'brutalist-accordion-content',
  setup(def) {
    asAccordionContent();
    def.feedback.style.use(
      tw(
        'block min-w-0 border-t-2 border-border p-4 text-base leading-relaxed break-words overflow-x-auto'
      )
    );
  },
});
