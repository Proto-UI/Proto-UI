import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerContent,
  type DrawerContentProps,
  type DrawerContentExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerContentProps, DrawerContentExposes>({
  name: 'bootstrap-2-3-2-drawer-content',
  setup(def) {
    const behavior = asDrawerContent();
    def.feedback.style.use(
      tw('rounded-md border border-border bg-background text-foreground shadow-lg p-4 grid gap-4')
    );
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
