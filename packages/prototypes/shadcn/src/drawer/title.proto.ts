import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerTitle,
  type DrawerTitleProps,
  type DrawerTitleExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerTitleProps, DrawerTitleExposes>({
  name: 'shadcn-drawer-title',
  setup(def) {
    asDrawerTitle();
    def.feedback.style.use(tw('text-foreground font-semibold'));
  },
});
