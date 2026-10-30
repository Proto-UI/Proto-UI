import { definePrototype, tw } from '@proto.ui/core';
import { asTabsRoot } from '@proto.ui/prototypes-base/tabs';
import { setupShadcnStyleScope } from '../style-scope';
import { setupTabsVisual, TABS_LIST_VARIANT } from './visual';
import type { ShadcnTabsRootExposes, ShadcnTabsRootProps } from './types';
const tabsRoot = definePrototype<ShadcnTabsRootProps, ShadcnTabsRootExposes>({
  name: 'shadcn-tabs-root',
  setup(def) {
    // P-SHADCN-TABS-BASE-INHERITANCE: no replacement of Base selection facts.
    asTabsRoot();
    // A nested Tabs domain must not consume an outer List's visual variant.
    def.context.provide(TABS_LIST_VARIANT, { variant: 'default' });
    setupShadcnStyleScope(def);
    const { orientation } = setupTabsVisual(def);
    def.feedback.style.use(tw('flex gap-2'));
    def.rule({
      when: (w) => w.state(orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-col')),
    });
  },
});
export default tabsRoot;
