import { definePrototype, tw } from '@proto.ui/core';
import {
  asTooltipContent,
  type TooltipContentProps as BaseTooltipContentProps,
  type TooltipContentExposes,
} from '@proto.ui/prototypes-base/tooltip';

export type TooltipContentProps = BaseTooltipContentProps & {
  /** Auto enhances floating tooltip popups; pass opaque to opt out. */
  material?: 'auto' | 'opaque';
};

export default definePrototype<TooltipContentProps, TooltipContentExposes>({
  name: 'liquid-glass-tooltip-content',
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const behavior = asTooltipContent();
    const { open } = behavior.stateHandles;
    def.feedback.style.use(
      tw(
        'z-50 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 font-sans text-xs font-medium text-secondary-foreground shadow-md ring-1 ring-inset ring-foreground/10 text-balance'
      )
    );
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 100 });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.all(w.state(open).eq(true), w.prop('material').eq('auto')),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular' }),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(true),
          w.state(behavior.asTransition.transitionState).eq('entering'),
          w.meta('preference.reducedMotion').eq('no-preference')
        ),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95 duration-150')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(false),
          w.state(behavior.asTransition.transitionState).eq('leaving'),
          w.meta('preference.reducedMotion').eq('no-preference')
        ),
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
