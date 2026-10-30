import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionRoot,
  type AccordionRootProps,
  type AccordionRootExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionRootProps, AccordionRootExposes>({
  name: 'bootstrap-2-3-2-accordion-root',
  setup(def) {
    const inherited = asAccordionRoot();
    def.feedback.style.use(
      tw('block min-w-0 mb-[20px] text-foreground text-[14px] leading-[20px]')
    );
    return inherited.render;
  },
});
