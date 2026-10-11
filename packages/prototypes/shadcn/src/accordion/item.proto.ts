import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionItem,
  type AccordionItemProps,
  type AccordionItemExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionItemProps, AccordionItemExposes>({
  name: 'shadcn-accordion-item',
  setup(def) {
    asAccordionItem();
    def.feedback.style.use(tw('block min-w-0 border-b border-border'));
  },
});
