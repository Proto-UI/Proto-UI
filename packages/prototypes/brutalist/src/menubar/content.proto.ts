import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarContent,
  type MenubarContentProps,
  type MenubarContentExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarContentProps, MenubarContentExposes>({
  name: 'brutalist-menubar-content',
  setup(def) {
    const behavior = asMenubarContent();
    def.feedback.style.use(
      tw(
        'rounded-none border-2 border-foreground bg-background text-foreground shadow-[3px_3px_0_0_var(--color-foreground)] z-50 min-w-40 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1'
      )
    );
  },
});
