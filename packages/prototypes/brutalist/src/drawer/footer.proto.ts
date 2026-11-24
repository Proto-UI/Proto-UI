import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerFooter,
  type DrawerFooterProps,
  type DrawerFooterExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerFooterProps, DrawerFooterExposes>({
  name: 'brutalist-drawer-footer',
  setup(def) {
    asDrawerFooter();
    def.feedback.style.use(tw('mt-[auto] flex flex-col gap-2 pt-2 font-sans'));
    return (renderer) => renderer.r.slot();
  },
});
