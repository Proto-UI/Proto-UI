import { definePrototype, tw } from '@proto.ui/core';
import { asTabsRoot } from '@proto.ui/prototypes-base/tabs';
import { setupShadcnStyleScope } from '../style-scope';
import { setupTabsVisual } from './visual';
import type { ShadcnTabsRootExposes, ShadcnTabsRootProps } from './types';
const tabsRoot = definePrototype<ShadcnTabsRootProps, ShadcnTabsRootExposes>({
  name: 'shadcn-tabs-root',
  setup(def) {
    // P-SHADCN-TABS-BASE-INHERITANCE: no replacement of Base selection facts.
    asTabsRoot();
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
