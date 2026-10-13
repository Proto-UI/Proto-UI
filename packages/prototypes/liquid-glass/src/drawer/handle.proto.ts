import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHandle,
  useDrawerHandleEdgeStyle,
  type DrawerHandleProps,
  type DrawerHandleExposes,
} from '@proto.ui/prototypes-base/drawer';
export default definePrototype<DrawerHandleProps, DrawerHandleExposes>({
  name: 'liquid-glass-drawer-handle',
  setup(def) {
    asDrawerHandle();
    useDrawerHandleEdgeStyle(def);
    def.feedback.style.use(tw('bg-foreground/30'));
  },
});
