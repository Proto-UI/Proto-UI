import { definePrototype, tw } from '@proto.ui/core';
import { asTabsRoot, TABS_CONTEXT } from '@proto.ui/prototypes-base/tabs';
import type { BrutalistTabsRootExposes, BrutalistTabsRootProps } from './types';

const tabsRoot = definePrototype<BrutalistTabsRootProps, BrutalistTabsRootExposes>({
  // P-BRUTALIST-TABS-ENTRY
  name: 'brutalist-tabs-root',
  setup(def) {
    // P-BRUTALIST-TABS-BASE-INHERITANCE
    asTabsRoot();
    const orientation = def.state.enum('brutalistTabsVisualOrientation', 'horizontal', {
      options: ['horizontal', 'vertical'],
    });
    def.context.subscribe(TABS_CONTEXT, (_run, next) => {
      orientation.set(next.orientation, 'reason: observe Base Tabs orientation for paint');
    });
    def.lifecycle.onMounted((run) => {
      orientation.set(
        run.context.read(TABS_CONTEXT).orientation,
        'reason: observe Base Tabs orientation for paint'
      );
    });
    // P-BRUTALIST-TABS-VISUAL-GRAMMAR — carries inherited text-foreground and adapts axis to Base orientation.
    def.feedback.style.use(tw('flex gap-3 text-foreground'));
    def.rule({
      when: (w) => w.state(orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('flex-col')),
    });
    def.rule({
      when: (w) => w.state(orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-row items-start')),
    });
  },
});

export default tabsRoot;
