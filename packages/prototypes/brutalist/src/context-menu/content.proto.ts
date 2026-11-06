import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import {
  asContextMenuContent,
  type ContextMenuContentProps,
  type ContextMenuContentExposes,
} from '@proto.ui/prototypes-base/context-menu';
export default definePrototype<ContextMenuContentProps, ContextMenuContentExposes>({
  name: 'brutalist-context-menu-content',
  setup(def) {
    const behavior = asContextMenuContent();
    def.feedback.style.use(
      tw(
        `${BRUTALIST_PANEL_TOKENS} z-50 min-w-40 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1`
      )
    );
  },
});
