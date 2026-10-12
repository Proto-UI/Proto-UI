import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerContent,
  type DrawerContentProps,
  type DrawerContentExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerContentProps, DrawerContentExposes>({
  name: 'shadcn-drawer-content',
  setup(def) {
    const behavior = asDrawerContent();
    def.props.setDefaults({ maxExtent: { unit: 'available-minus-root-text', value: 6 } });
    // Keep existing uniform edge paint until directional style translation is supported.
    def.feedback.style.use(
      tw('rounded-lg border border-border bg-background text-foreground shadow-md flex flex-col')
    );
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
