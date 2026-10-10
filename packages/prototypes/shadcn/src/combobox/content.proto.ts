import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxContent,
  type ComboboxContentProps,
  type ComboboxContentExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxContentProps, ComboboxContentExposes>({
  name: 'shadcn-combobox-content',
  setup(def) {
    const behavior = asComboboxContent();
    def.feedback.style.use(
      tw(
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-md z-50 min-w-0 w-[max(var(--proto-ui-anchor-width,16rem),12rem)] max-w-[var(--proto-ui-available-width,100%)] max-h-[var(--proto-ui-available-height,20rem)] overflow-y-auto p-1'
      )
    );
  },
});
