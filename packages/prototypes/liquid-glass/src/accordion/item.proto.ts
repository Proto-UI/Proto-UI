import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionItem,
  type AccordionItemProps,
  type AccordionItemExposes,
} from '@proto.ui/prototypes-base/accordion';
// Opaque source-stage projection. Optical material must use the shared intent contract; no native-blur substitution.
export default definePrototype<AccordionItemProps, AccordionItemExposes>({
  name: 'liquid-glass-accordion-item',
  setup(def) {
    asAccordionItem();
    def.feedback.style.use(tw('block min-w-0 rounded-2xl border border-border bg-background'));
  },
});
