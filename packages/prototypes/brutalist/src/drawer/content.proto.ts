import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerContent,
  type DrawerContentProps,
  type DrawerContentExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerContentProps, DrawerContentExposes>({
  name: 'brutalist-drawer-content',
  setup(def) {
    const behavior = asDrawerContent();
    def.feedback.style.use(
      tw(
        'rounded-none border-2 border-foreground bg-background text-foreground shadow-[4px_4px_0_0_var(--pui-foreground)] p-4 grid gap-4'
      )
    );
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
