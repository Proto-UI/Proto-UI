import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerTitle,
  type DrawerTitleProps,
  type DrawerTitleExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerTitleProps, DrawerTitleExposes>({
  name: 'brutalist-drawer-title',
  setup(def) {
    const behavior = asDrawerTitle();
    def.feedback.style.use(tw('text-xl font-black'));
  },
});
