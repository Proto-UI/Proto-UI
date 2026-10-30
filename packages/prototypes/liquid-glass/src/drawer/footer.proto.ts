import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerFooter,
  type DrawerFooterProps,
  type DrawerFooterExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerFooterProps, DrawerFooterExposes>({
  name: 'liquid-glass-drawer-footer',
  setup(def) {
    asDrawerFooter();
    // Pinned action row parked at the trailing edge; same portable arbitrary
    // auto-margin the existing family-adjacent footer recipes use.
    def.feedback.style.use(tw('mt-[auto] flex flex-col gap-2 p-4'));
    return (renderer) => renderer.r.slot();
  },
});
