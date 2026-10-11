import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHandle,
  type DrawerHandleProps,
  type DrawerHandleExposes,
} from '@proto.ui/prototypes-base/drawer';
export default definePrototype<DrawerHandleProps, DrawerHandleExposes>({
  name: 'brutalist-drawer-handle',
  setup(def) {
    asDrawerHandle();
    def.feedback.style.use(tw('border-2 border-black bg-black'));
  },
});
