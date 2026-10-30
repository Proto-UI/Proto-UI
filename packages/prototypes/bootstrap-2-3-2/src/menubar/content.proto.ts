import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarContent,
  type MenubarContentProps,
  type MenubarContentExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarContentProps, MenubarContentExposes>({
  name: 'bootstrap-2-3-2-menubar-content',
  modules: asMenubarContent.modules,
  setup(def) {
    const behavior = asMenubarContent();
    def.props.setDefaults({ sideOffset: 2 });
    def.feedback.style.use(
      tw(
        'z-[1000] min-w-[160px] max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto rounded-[6px] border border-[rgb(0_0_0/20%)] bg-background bg-clip-padding text-foreground py-[5px] shadow-[0_5px_10px_rgb(0_0_0/20%)]'
      )
    );
    return behavior.render;
  },
});
