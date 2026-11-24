import { definePrototype, tw } from '@proto.ui/core';
import {
  asTabsContent,
  type TabsContentProps,
  type TabsContentExposes,
} from '@proto.ui/prototypes-base/tabs';

export default definePrototype<TabsContentProps, TabsContentExposes>({
  name: 'liquid-glass-tabs-content',
  setup(def) {
    const tabs = asTabsContent().stateHandles;
    if (!tabs) throw new Error('Tabs Content capture missing');
    def.feedback.style.use(tw('flex-1 min-w-0 text-sm text-foreground'));
    def.rule({
      when: (w) => w.state(tabs.hidden).eq(true),
      intent: (i) => i.feedback.style.use(tw('hidden')),
    });
  },
});
