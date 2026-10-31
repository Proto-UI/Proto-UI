import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionContent,
  type AccordionContentExposes,
} from '@proto.ui/prototypes-base/accordion';
import { setupAccordionContentPaint } from './visual';
import type { ShadcnAccordionContentProps } from './types';
export default definePrototype<ShadcnAccordionContentProps, AccordionContentExposes>({
  name: 'shadcn-accordion-content',
  modules: asAccordionContent.modules,
  setup(def) {
    const inherited = asAccordionContent();
    setupAccordionContentPaint(def);
    // Own the family panel's formatting context. A conditional hidden token
    // withdraws WC's fallback display even while open; block children must
    // still lay out inside the profile padding, without a page CSS patch.
    // The Base open/hidden facts remain the only visibility/presence owners.
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.open).eq(true),
      intent: (i) => i.feedback.style.use(tw('block')),
    });
    return inherited.render;
  },
});
