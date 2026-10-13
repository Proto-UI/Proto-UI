import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHandle,
  useDrawerHandleEdgeStyle,
  type DrawerHandleProps,
  type DrawerHandleExposes,
} from '@proto.ui/prototypes-base/drawer';
export default definePrototype<DrawerHandleProps, DrawerHandleExposes>({
  name: 'brutalist-drawer-handle',
  setup(def) {
    asDrawerHandle();
    useDrawerHandleEdgeStyle(def);
    def.feedback.style.use(tw('border-2 border-black bg-black'));
  },
});
