import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerFooter,
  type DrawerFooterProps,
  type DrawerFooterExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerFooterProps, DrawerFooterExposes>({
  name: 'shadcn-drawer-footer',
  setup(def) {
    asDrawerFooter();
    // New York mt-auto; existing portable arbitrary spacing expresses the same auto margin.
    def.feedback.style.use(tw('mt-[auto] flex flex-col gap-2 p-4'));
    return (renderer) => renderer.r.slot();
  },
});
