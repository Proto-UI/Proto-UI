import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionRoot,
  type AccordionRootProps,
  type AccordionRootExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionRootProps, AccordionRootExposes>({
  name: 'brutalist-accordion-root',
  modules: asAccordionRoot.modules,
  setup(def) {
    const inherited = asAccordionRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 gap-3 text-foreground'));
    def.rule({
      when: (w) => w.prop('orientation').eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-row flex-wrap')),
    });
    def.rule({
      when: (w) => w.not(w.prop('orientation').eq('horizontal')),
      intent: (i) => i.feedback.style.use(tw('flex-col')),
    });
    def.rule({
      when: (w) => w.prop('direction').eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('direction-rtl')),
    });
    return inherited.render;
  },
});
