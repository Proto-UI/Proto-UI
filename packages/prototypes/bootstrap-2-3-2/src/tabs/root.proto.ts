import { definePrototype, tw } from '@proto.ui/core';
import {
  asTabsRoot,
  TABS_CONTEXT,
  type TabsRootProps,
  type TabsRootExposes,
} from '@proto.ui/prototypes-base/tabs';

export default definePrototype<TabsRootProps, TabsRootExposes>({
  name: 'bootstrap-2-3-2-tabs-root',
  setup(def) {
    asTabsRoot();
    const orientation = def.state.enum('bootstrapTabsVisualOrientation', 'horizontal', {
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
    def.feedback.style.use(tw('flex min-w-0 gap-3 text-foreground'));
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
