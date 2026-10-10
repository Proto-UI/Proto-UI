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
        'block min-w-0 bg-secondary-background text-foreground p-4 text-sm font-sans font-medium leading-relaxed break-words overflow-x-auto'
      )
    );
  },
});
