import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerDescription,
  type DrawerDescriptionProps,
  type DrawerDescriptionExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerDescriptionProps, DrawerDescriptionExposes>({
  name: 'liquid-glass-drawer-description',
  setup(def) {
    const behavior = asDrawerDescription();
    def.feedback.style.use(tw('text-sm text-muted-foreground'));
  },
});
