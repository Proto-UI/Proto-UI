import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHandle,
  useDrawerHandleEdgeStyle,
  type DrawerHandleProps,
  type DrawerHandleExposes,
} from '@proto.ui/prototypes-base/drawer';
export default definePrototype<DrawerHandleProps, DrawerHandleExposes>({
  name: 'bootstrap-2-3-2-drawer-handle',
  setup(def) {
    asDrawerHandle();
    useDrawerHandleEdgeStyle(def);
    def.feedback.style.use(tw('border border-[#bbb] bg-[#ccc] shadow-inner'));
  },
});
