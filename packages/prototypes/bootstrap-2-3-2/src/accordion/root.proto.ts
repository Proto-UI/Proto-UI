import { definePrototype, tw } from '@proto.ui/core';
import {
  asAccordionRoot,
  type AccordionRootProps,
  type AccordionRootExposes,
} from '@proto.ui/prototypes-base/accordion';
export default definePrototype<AccordionRootProps, AccordionRootExposes>({
  name: 'bootstrap-2-3-2-accordion-root',
  modules: asAccordionRoot.modules,
  setup(def) {
    const inherited = asAccordionRoot();
    def.feedback.style.use(
      tw('block min-w-0 mb-[20px] text-foreground text-[14px] leading-[20px]')
    );
    def.rule({
      when: (w) => w.prop('orientation').eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex flex-row flex-wrap gap-2')),
    });
    def.rule({
      when: (w) => w.prop('direction').eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('direction-rtl')),
    });
    return inherited.render;
  },
});
