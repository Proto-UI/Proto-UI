import { definePrototype, tw } from '@proto.ui/core';
import { asTabsContent } from '@proto.ui/prototypes-base/tabs';
import { setupTabsVisual, TABS_PROJECTED_STYLES, TAB_CONTENT_TEXT } from './visual';
import type { ShadcnTabsContentExposes, ShadcnTabsContentProps } from './types';
const tabsContent = definePrototype<ShadcnTabsContentProps, ShadcnTabsContentExposes>({
  name: 'shadcn-tabs-content',
  setup(def) {
    const { hidden } = asTabsContent().stateHandles!;
    const { style } = setupTabsVisual(def);
    def.feedback.style.use(tw('flex-1 outline-none'));
    // `.cn-tabs-content` text size per style; new-york-v4 declares none.
    for (const id of TABS_PROJECTED_STYLES) {
      const recipe = TAB_CONTENT_TEXT[id];
      if (!recipe) continue;
      def.rule({
        when: (w) => w.state(style).eq(id),
        intent: (i) => i.feedback.style.use(recipe),
      });
    }
    def.rule({
      when: (w) => w.state(hidden).eq(true),
      intent: (i) => i.feedback.style.use(tw('hidden')),
    });
  },
});
export default tabsContent;
