import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerDescription,
  type DrawerDescriptionProps,
  type DrawerDescriptionExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerDescriptionProps, DrawerDescriptionExposes>({
  name: 'brutalist-drawer-description',
  setup(def) {
    asDrawerDescription();
    def.feedback.style.use(tw('font-sans text-sm font-medium text-muted-foreground'));
  },
});
