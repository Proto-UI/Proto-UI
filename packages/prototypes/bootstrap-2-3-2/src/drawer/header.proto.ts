import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHeader,
  type DrawerHeaderProps,
  type DrawerHeaderExposes,
} from '@proto.ui/prototypes-base/drawer';

// Semantic header row: upstream .modal-header carries 9px/15px padding and a 1px #eee
// bottom rule (twbs/bootstrap@b4c4072 less/modals.less). Drawer is a family extension
// reusing the same modal chrome vocabulary; the Base anatomy claim and slot stay Base's.
export default definePrototype<DrawerHeaderProps, DrawerHeaderExposes>({
  name: 'bootstrap-2-3-2-drawer-header',
  setup(def) {
    asDrawerHeader();
    def.feedback.style.use(tw('min-w-0 px-[15px] py-[9px] border-b border-[#eee]'));
    return (renderer) => renderer.r.slot();
  },
});
