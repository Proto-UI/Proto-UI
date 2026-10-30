import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import {
  asAccordionItem,
  ACCORDION_FAMILY,
  type AccordionItemExposes,
} from '@proto.ui/prototypes-base/accordion';
import { setupAccordionStyle } from './visual';
import type { ShadcnAccordionItemProps } from './types';
export default definePrototype<ShadcnAccordionItemProps, AccordionItemExposes>({
  name: 'shadcn-accordion-item',
  modules: asAccordionItem.modules,
  setup(def) {
    const inherited = asAccordionItem();
    const style = setupAccordionStyle(def);
    const followed = def.state.bool('accordionHasFollowingItem', false);
    const syncOrder = (run: RunHandle<ShadcnAccordionItemProps>) => {
      followed.set(
        run.anatomy.order.nextOfSelf(ACCORDION_FAMILY, 'item') !== null,
        'accordion item order'
      );
    };
    def.anatomy.subscribeParts(ACCORDION_FAMILY, 'item', (run, parts) => {
      if (parts.length === 0) {
        followed.set(false, 'accordion item domain withdrawn');
        return;
      }
      syncOrder(run);
    });
    def.lifecycle.onMounted(syncOrder);
    def.feedback.style.use(tw('block min-w-0 border-border'));
    def.rule({
      when: (w) => w.state(followed).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-b')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(inherited.stateHandles!.open).eq(true),
          w.any(
            w.state(style).eq('maia'),
            w.state(style).eq('mira'),
            w.state(style).eq('luma'),
            w.state(style).eq('rhea')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
    });
    return inherited.render;
  },
});
