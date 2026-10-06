import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionContent,
  type AccordionContentProps,
  type AccordionContentExposes,
} from '@proto.ui/prototypes-base/accordion';
// Opaque source-stage projection. Optical material must use the shared intent contract; no native-blur substitution.
export default definePrototype<AccordionContentProps, AccordionContentExposes>({
  name: 'liquid-glass-accordion-content',
  setup(def) {
    asAccordionContent();
    def.feedback.style.use(
      tw('block min-w-0 px-4 pb-4 text-base leading-relaxed break-words overflow-x-auto')
    );
  },
});
