import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarContent,
  type MenubarContentProps,
  type MenubarContentExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarContentProps, MenubarContentExposes>({
  name: 'shadcn-menubar-content',
  setup(def) {
    const behavior = asMenubarContent();
    def.feedback.style.use(
      tw(
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-md z-50 min-w-40 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1'
      )
    );
  },
});
