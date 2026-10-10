import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHandle,
  type DrawerHandleProps,
  type DrawerHandleExposes,
} from '@proto.ui/prototypes-base/drawer';
export default definePrototype<DrawerHandleProps, DrawerHandleExposes>({
  name: 'liquid-glass-drawer-handle',
  setup(def) {
    asDrawerHandle();
    def.feedback.style.use(tw('bg-foreground/30'));
  },
});
