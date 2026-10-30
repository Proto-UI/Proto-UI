import { definePrototype, tw } from '@proto.ui/core';
import {
  asHoverCardContent,
  type HoverCardContentProps,
  type HoverCardContentExposes,
} from '@proto.ui/prototypes-base/hover-card';

// Upstream .popover surface: max-width 276px, padding 1px, left-aligned normal wrap,
// white padding-box-clipped surface, rgba(0,0,0,.2) border over #ccc, 6px radius and
// 0 5px 10px rgba(0,0,0,.2) shadow; the passive .popover-content wrapper has 9px/14px
// padding. The plugin inherits animation:true from Tooltip,
// adding the shared .fade opacity .15s linear. HoverCard keeps Base interaction delays,
// not Bootstrap's click activation/delay:0. The directional arrow remains a Base gap.
// https://github.com/twbs/bootstrap/blob/b4c4072679943773a7582daa63f545ba818fa627/less/popovers.less
// https://github.com/twbs/bootstrap/blob/b4c4072679943773a7582daa63f545ba818fa627/less/component-animations.less
// https://github.com/twbs/bootstrap/blob/b4c4072679943773a7582daa63f545ba818fa627/js/bootstrap-popover.js
// https://github.com/twbs/bootstrap/blob/b4c4072679943773a7582daa63f545ba818fa627/js/bootstrap-tooltip.js
export default definePrototype<HoverCardContentProps, HoverCardContentExposes>({
  name: 'bootstrap-2-3-2-hover-card-content',
  setup(def) {
    const behavior = asHoverCardContent();
    def.feedback.style.use(
      tw(
        'z-50 max-w-[276px] p-[1px] text-left whitespace-normal bg-background bg-clip-padding border border-[rgb(0_0_0/20%)] rounded-[6px] shadow-[0_5px_10px_rgb(0_0_0/20%)] text-foreground'
      )
    );
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });
    def.feedback.style.presence({
      owner: behavior.asTransition.presentationOwner,
      closed: { opacity: 0 },
      entered: { opacity: 1 },
      easing: [0, 0, 1, 1],
    });
    return (renderer) => renderer.el('div', { style: tw('px-[14px] py-[9px]') }, renderer.r.slot());
  },
});
