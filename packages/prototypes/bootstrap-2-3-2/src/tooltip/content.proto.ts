import { definePrototype, tw } from '@proto.ui/core';
import {
  asTooltipContent,
  type TooltipContentProps,
  type TooltipContentExposes,
} from '@proto.ui/prototypes-base/tooltip';

// Upstream .tooltip-inner: max-width 200px, 8px padding, @tooltipColor #fff text on
// @tooltipBackground #000, centered, @baseBorderRadius 4px; the .tooltip wrapper adds
// font-size 11px / line-height 1.4 and .in opacity .8 via the shared .fade
// transition(opacity .15s linear). line-height 1.4 is written as its exact computed
// 15.4px because the finite typography vocabulary accepts px lengths only
// (twbs/bootstrap@b4c4072 less/tooltip.less,
// less/component-animations.less, less/variables.less). The 0 -> 0.8 opacity path rides
// the Transition presentation channel at 150ms; the directional .tooltip-arrow has no
// Base part and is reported as a documented anatomy gap rather than invented markup.
export default definePrototype<TooltipContentProps, TooltipContentExposes>({
  name: 'bootstrap-2-3-2-tooltip-content',
  setup(def) {
    const behavior = asTooltipContent();
    def.feedback.style.use(
      tw(
        'z-50 max-w-[200px] p-[8px] text-center text-[11px] leading-[15.4px] text-white bg-black rounded-[4px] whitespace-normal'
      )
    );
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });
    def.feedback.style.presence({
      owner: behavior.asTransition.presentationOwner,
      closed: { opacity: 0 },
      entered: { opacity: 0.8 },
      easing: [0, 0, 1, 1],
    });
    return (renderer) => [renderer.r.slot()];
  },
});
