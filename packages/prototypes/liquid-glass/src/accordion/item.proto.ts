import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionItem,
  type AccordionItemProps,
  type AccordionItemExposes,
} from '@proto.ui/prototypes-base/accordion';
// The structural Item must not obscure the Trigger's authored backdrop.
// Trigger owns optical intent and its fallback; Content owns its ordinary fill.
export default definePrototype<AccordionItemProps, AccordionItemExposes>({
  name: 'liquid-glass-accordion-item',
  setup(def) {
    asAccordionItem();
    def.feedback.style.use(tw('block min-w-0 rounded-2xl border border-border bg-transparent'));
  },
});
