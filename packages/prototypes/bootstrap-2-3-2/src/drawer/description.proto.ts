import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerDescription,
  type DrawerDescriptionProps,
  type DrawerDescriptionExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerDescriptionProps, DrawerDescriptionExposes>({
  name: 'bootstrap-2-3-2-drawer-description',
  setup(def) {
    asDrawerDescription();
    def.feedback.style.use(tw('m-0 mt-1 text-[14px] leading-[20px] text-muted-foreground'));
  },
});
