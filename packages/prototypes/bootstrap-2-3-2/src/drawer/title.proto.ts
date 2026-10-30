import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerTitle,
  type DrawerTitleProps,
  type DrawerTitleExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerTitleProps, DrawerTitleExposes>({
  name: 'bootstrap-2-3-2-drawer-title',
  setup(def) {
    asDrawerTitle();
    def.feedback.style.use(tw('m-0 text-[24.5px] font-bold leading-[30px]'));
  },
});
