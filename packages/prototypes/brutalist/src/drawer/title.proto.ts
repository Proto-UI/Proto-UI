import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerTitle,
  type DrawerTitleProps,
  type DrawerTitleExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerTitleProps, DrawerTitleExposes>({
  name: 'brutalist-drawer-title',
  setup(def) {
    asDrawerTitle();
    def.feedback.style.use(tw('font-heading text-lg font-bold leading-none tracking-tight text-foreground'));
  },
});
