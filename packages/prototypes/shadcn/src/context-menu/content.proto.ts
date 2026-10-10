import { definePrototype, tw } from '@proto.ui/core';
import {
  asContextMenuContent,
  type ContextMenuContentProps,
  type ContextMenuContentExposes,
} from '@proto.ui/prototypes-base/context-menu';
export default definePrototype<ContextMenuContentProps, ContextMenuContentExposes>({
  name: 'shadcn-context-menu-content',
  setup(def) {
    const behavior = asContextMenuContent();
    def.feedback.style.use(
      tw(
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-md z-50 min-w-40 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1'
      )
    );
  },
});
