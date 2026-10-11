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
    def.feedback.style.use(tw('min-w-0'));
    def.rule({
      when: (w) => w.state(tabs.hidden).eq(true),
      intent: (i) => i.feedback.style.use(tw('hidden')),
    });
  },
});
