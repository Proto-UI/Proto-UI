import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionRoot,
  type AccordionRootProps,
  type AccordionRootExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionRootProps, AccordionRootExposes>({
  name: 'bootstrap-2-3-2-accordion-root',
  setup(def) {
    asAccordionRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-0.5 text-foreground'));
  },
});
