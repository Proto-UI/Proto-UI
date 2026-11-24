import { definePrototype, tw } from '@proto.ui/core';
import {
  asTooltipContent,
  type TooltipContentProps,
  type TooltipContentExposes,
} from '@proto.ui/prototypes-base/tooltip';

export default definePrototype<TooltipContentProps, TooltipContentExposes>({
  name: 'liquid-glass-tooltip-content',
  setup(def) {
    const behavior = asTooltipContent();
    const { open } = behavior.stateHandles;
    // Supplementary non-interactive text uses a refined standard opaque material
    // with concentric radius and specular hairline (no liquid-glass material slot,
    // avoiding glass-on-glass stacking over Liquid Glass controls per Apple HIG).
    def.feedback.style.use(
      tw(
        'z-50 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 font-sans text-xs font-medium text-secondary-foreground shadow-md ring-1 ring-inset ring-foreground/10 text-balance'
      )
    );
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 100 });
    def.rule({
      when: (w) => w.state(open).eq(true),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95 duration-150')),
    });
    def.rule({
      when: (w) => w.state(open).eq(false),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95 duration-100')),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.meta('preference.reducedTransparency').eq('reduce'),
          w.meta('preference.forcedColors').eq('active')
        ),
      intent: (i) => i.feedback.style.use(tw('border-foreground shadow-none ring-0')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('animate-none transition-none')),
    });
    return (renderer) => [renderer.r.slot()];
  },
});
