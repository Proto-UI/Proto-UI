import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionContent,
  type AccordionContentProps,
  type AccordionContentExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionContentProps, AccordionContentExposes>({
  name: 'bootstrap-2-3-2-accordion-content',
  setup(def) {
    const inherited = asAccordionContent();
    def.feedback.style.use(
      tw(
        'block min-w-0 border-t border-[#e5e5e5] px-[15px] py-[9px] text-[14px] leading-[20px] break-words overflow-x-auto'
      )
    );
    return inherited.render;
  },
});
