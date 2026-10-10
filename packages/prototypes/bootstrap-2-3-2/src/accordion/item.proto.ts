import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionItem,
  type AccordionItemProps,
  type AccordionItemExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionItemProps, AccordionItemExposes>({
  name: 'bootstrap-2-3-2-accordion-item',
  setup(def) {
    asAccordionItem();
    def.feedback.style.use(tw('block min-w-0 rounded-[4px] border border-border bg-background'));
  },
});
