import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionItem,
  type AccordionItemProps,
  type AccordionItemExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionItemProps, AccordionItemExposes>({
  name: 'brutalist-accordion-item',
  modules: asAccordionItem.modules,
  setup(def) {
    const inherited = asAccordionItem();
    def.feedback.style.use(
      tw(
        'block min-w-0 rounded-base overflow-hidden border-2 border-border bg-background shadow-[4px_4px_0_0_var(--pui-foreground)]'
      )
    );
    return inherited.render;
  },
});
