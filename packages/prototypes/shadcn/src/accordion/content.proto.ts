import { definePrototype } from '@proto.ui/core';
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
    return inherited.render;
  },
});
