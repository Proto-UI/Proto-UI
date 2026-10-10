import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionRoot,
  type AccordionRootProps,
  type AccordionRootExposes,
} from '@proto.ui/prototypes-base/accordion';
// Opaque source-stage projection. Optical material must use the shared intent contract; no native-blur substitution.
export default definePrototype<AccordionRootProps, AccordionRootExposes>({
  name: 'liquid-glass-accordion-root',
  setup(def) {
    asAccordionRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-2 text-foreground'));
  },
});
