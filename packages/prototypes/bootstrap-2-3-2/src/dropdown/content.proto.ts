import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownContent,
  type DropdownContentProps,
  type DropdownContentExposes,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownContentProps, DropdownContentExposes>({
  name: 'bootstrap-2-3-2-dropdown-content',
  modules: asDropdownContent.modules,
  setup(def) {
    const behavior = asDropdownContent();
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
    def.props.setDefaults({ align: 'start', sideOffset: 2 });
    def.feedback.style.use(
      tw(
        'z-[1000] min-w-[160px] max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto rounded-[6px] border border-[rgb(0_0_0/20%)] bg-background bg-clip-padding text-foreground py-[5px] shadow-[0_5px_10px_rgb(0_0_0/20%)]'
      )
    );
  },
});
