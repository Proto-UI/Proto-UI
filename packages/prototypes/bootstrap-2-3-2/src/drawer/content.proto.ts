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
    // A Proto extension using modal box vocabulary, not a Bootstrap Drawer or
    // jQuery component. Base retains extent, edge, scroll and input ownership.
    def.feedback.style.use(
      tw(
        'min-w-0 rounded-[6px] border border-[rgb(0_0_0/30%)] bg-white bg-clip-padding text-[#333] text-[14px] leading-[20px] shadow-[0_3px_7px_rgb(0_0_0/30%)]'
      )
    );
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
