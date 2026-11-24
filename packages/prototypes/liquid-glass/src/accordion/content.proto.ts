import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionContent,
  type AccordionContentProps,
  type AccordionContentExposes,
} from '@proto.ui/prototypes-base/accordion';
// Opaque source-stage projection. Optical material must use the shared intent contract; no native-blur substitution.
export default definePrototype<AccordionContentProps, AccordionContentExposes>({
  name: 'liquid-glass-accordion-content',
  modules: asAccordionContent.modules,
  setup(def) {
    const inherited = asAccordionContent();
    def.feedback.style.use(
      tw(
        'block min-w-0 w-[calc(100cqw_-_2px)] mx-auto bg-background text-foreground rounded-2xl border-t border-border/50 px-4 pt-3 pb-4 text-base leading-relaxed break-words overflow-x-auto'
      )
    );
    return inherited.render;
  },
});
