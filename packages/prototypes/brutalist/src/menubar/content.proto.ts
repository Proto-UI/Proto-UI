import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import {
  asMenubarContent,
  type MenubarContentProps,
  type MenubarContentExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarContentProps, MenubarContentExposes>({
  name: 'brutalist-menubar-content',
  modules: asMenubarContent.modules,
  setup(def) {
    const behavior = asMenubarContent();
    def.feedback.style.use(
      tw(
        `${BRUTALIST_PANEL_TOKENS} z-50 min-w-44 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1 outline-none shadow-[3px_3px_0_0_var(--pui-foreground)]`
      )
    );
    return behavior.render;
  },
});
