import { definePrototype, tw } from '@proto.ui/core';
import {
  asTabsRoot,
  type TabsRootProps,
  type TabsRootExposes,
} from '@proto.ui/prototypes-base/tabs';
export default definePrototype<TabsRootProps, TabsRootExposes>({
  name: 'liquid-glass-tabs-root',
  setup(def) {
    asTabsRoot();
    def.feedback.style.use(tw('flex min-w-0 flex-col gap-3 text-foreground'));
  },
});
