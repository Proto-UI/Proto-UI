import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownContent,
  type DropdownContentProps,
  type DropdownContentExposes,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownContentProps, DropdownContentExposes>({
  name: 'bootstrap-2-3-2-dropdown-content',
  setup(def) {
    const behavior = asDropdownContent();
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
    def.feedback.style.use(
      tw(
        'z-50 min-w-32 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-x-hidden overflow-y-auto outline-none rounded-[6px] border border-border bg-background text-foreground py-[0.3125rem] shadow-[0_5px_10px_rgb(0_0_0/20%)]'
      )
    );
  },
});
