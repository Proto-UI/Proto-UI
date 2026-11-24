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
    // The explicit Heading reservation may extend the intrinsic border box
    // equally on both sides. Its Trigger retains the independent Root width;
    // normal flow reserves space above/below it, including when Content opens.
    def.feedback.style.use(
      tw('block min-w-full self-center rounded-2xl border border-border bg-transparent')
    );
  },
});
