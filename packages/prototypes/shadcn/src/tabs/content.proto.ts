import { definePrototype, tw } from '@proto.ui/core';
import { asTabsContent } from '@proto.ui/prototypes-base/tabs';
import { setupTabsVisual } from './visual';
import type { ShadcnTabsContentExposes, ShadcnTabsContentProps } from './types';
const tabsContent = definePrototype<ShadcnTabsContentProps, ShadcnTabsContentExposes>({
  name: 'shadcn-tabs-content',
  setup(def) {
    const { hidden } = asTabsContent().stateHandles!;
    const { style } = setupTabsVisual(def);
    def.feedback.style.use(tw('flex-1 outline-none'));
    def.rule({
      when: (w) => w.not(w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    });
    def.rule({
      when: (w) => w.state(hidden).eq(true),
      intent: (i) => i.feedback.style.use(tw('hidden')),
    });
  },
});
export default tabsContent;
