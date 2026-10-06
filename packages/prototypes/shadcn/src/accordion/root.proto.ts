import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionRoot,
  type AccordionRootProps,
  type AccordionRootExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionRootProps, AccordionRootExposes>({
  name: 'shadcn-accordion-root',
  setup(def) {
    asAccordionRoot();
    def.feedback.style.use(tw('block w-full min-w-0 text-foreground'));
  },
});
