import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerFooter,
  type DrawerFooterProps,
  type DrawerFooterExposes,
} from '@proto.ui/prototypes-base/drawer';

// Upstream .modal-footer: 14px 15px 15px padding, right-aligned buttons with 5px
// spacing, #f5f5f5 background, 1px #ddd top rule, inset 0 1px 0 @white highlight and
// bottom 6px radius. text-align:right is kept as such, not a flex alignment substitute.
// Semantic colors are a Proto dark-mode adaptation; omit the fixed white inset highlight.
// Upstream sibling .btn margins are not installed on arbitrary authored slot children.
// https://github.com/twbs/bootstrap/blob/b4c4072679943773a7582daa63f545ba818fa627/less/modals.less
export default definePrototype<DrawerFooterProps, DrawerFooterExposes>({
  name: 'bootstrap-2-3-2-drawer-footer',
  setup(def) {
    asDrawerFooter();
    def.feedback.style.use(
      tw(
        'mb-0 px-[15px] pt-[14px] pb-[15px] text-right bg-secondary text-secondary-foreground border-t border-border rounded-b-[6px] shadow-none'
      )
    );
    return (renderer) => renderer.r.slot();
  },
});
