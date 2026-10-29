import { definePrototype, tw } from '@proto.ui/core';
import { asAccordionRoot, type AccordionRootExposes } from '@proto.ui/prototypes-base/accordion';
import { setupShadcnStyleScope } from '../style-scope';
import { setupAccordionStyle } from './visual';
import type { ShadcnAccordionRootProps } from './types';
export default definePrototype<ShadcnAccordionRootProps, AccordionRootExposes>({
  name: 'shadcn-accordion-root',
  modules: asAccordionRoot.modules,
  setup(def) {
    const inherited = asAccordionRoot();
    setupShadcnStyleScope(def);
    const style = setupAccordionStyle(def);
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col text-foreground'));
    def.rule({
      when: (w) =>
        w.any(w.state(style).eq('maia'), w.state(style).eq('luma'), w.state(style).eq('rhea')),
      intent: (i) =>
        i.feedback.style.use(
          tw('rounded-[var(--pui-radius-2xl)] border border-border overflow-hidden')
        ),
    });
    def.rule({
      when: (w) => w.state(style).eq('mira'),
      intent: (i) => i.feedback.style.use(tw('rounded-md border border-border overflow-hidden')),
    });
    return inherited.render;
  },
});
