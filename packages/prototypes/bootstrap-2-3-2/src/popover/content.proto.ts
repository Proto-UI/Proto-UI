import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverContent,
  type PopoverContentProps,
  type PopoverContentExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverContentProps, PopoverContentExposes>({
  name: 'bootstrap-2-3-2-popover-content',
  modules: asPopoverContent.modules,
  setup(def) {
    const behavior = asPopoverContent();
    def.props.setDefaults({ side: 'right', sideOffset: 10 });
    // The Proto positioning owner replaces upstream absolute top/left and
    // z-index. The 1px shell and 276px cap are .popover, not .popover-content.
    def.feedback.style.use(
      tw(
        'rounded-[6px] border border-[rgb(0_0_0/20%)] bg-background bg-clip-padding text-foreground font-sans text-[14px] leading-[20px] shadow-[0_5px_10px_rgb(0_0_0/20%)] p-[1px] max-w-[min(276px,var(--proto-ui-available-width))] max-h-[var(--proto-ui-available-height)] overflow-y-auto text-left whitespace-normal'
      )
    );
    // bootstrap-popover.js inherits Tooltip's animation:true. .fade is
    // opacity .15s linear; no fabricated top/scale motion is added.
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });
    def.feedback.style.presence({
      owner: behavior.asTransition.presentationOwner,
      closed: { opacity: 0 },
      entered: { opacity: 1 },
      easing: [0, 0, 1, 1],
    });
  },
});
