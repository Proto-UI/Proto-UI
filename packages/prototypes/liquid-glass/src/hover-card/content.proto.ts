import { definePrototype, tw } from '@proto.ui/core';
import {
  asHoverCardContent,
  type HoverCardContentProps,
  type HoverCardContentExposes,
} from '@proto.ui/prototypes-base/hover-card';

export interface LiquidGlassHoverCardContentProps extends HoverCardContentProps {
  /** Surface prominence hierarchy: regular floating glass or tinted prominent card. */
  variant?: 'regular' | 'prominent';
  /** Auto enables liquid-glass material when live host support is affirmative; opaque opts out. */
  material?: 'auto' | 'opaque';
}

const FILLS = {
  regular: 'bg-secondary text-secondary-foreground',
  prominent: 'bg-primary text-primary-foreground',
} as const;

export default definePrototype<LiquidGlassHoverCardContentProps, HoverCardContentExposes>({
  name: 'liquid-glass-hover-card-content',
  setup(def) {
    const behavior = asHoverCardContent();
    def.props.define({
      variant: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'regular', material: 'auto' });

    const { open } = behavior.stateHandles;
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });

    // Concentric outer surface (rounded-2xl + p-4 pairs with rounded-xl inner items)
    // with complete opaque fallback when translucency is reduced or unavailable.
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border shadow-md p-4 z-50 w-80 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto grid gap-3 text-sm text-start outline-none transition-none duration-150'
      )
    );
    (Object.keys(FILLS) as Array<keyof typeof FILLS>).forEach((variant) => {
      def.rule({
        when: (w) => w.prop('variant').eq(variant),
        intent: (i) => i.feedback.style.use(tw(FILLS[variant])),
      });
    });

    // Specular inner rim highlight and elevated floating depth when transparency is permitted.
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-1 ring-inset ring-foreground/10 shadow-lg')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.meta('colorScheme').eq('dark'),
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none')
        ),
      intent: (i) => i.feedback.style.use(tw('shadow-xl')),
    });

    // Keep entry/leave keyframes inside Base's finite transition phases so no
    // forwards-filled transform blocks optical compositing at rest.
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(true),
          w.state(behavior.asTransition.transitionState).eq('entering'),
          w.meta('preference.reducedMotion').eq('no-preference')
        ),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(false),
          w.state(behavior.asTransition.transitionState).eq('leaving'),
          w.meta('preference.reducedMotion').eq('no-preference')
        ),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(true),
          w.state(behavior.asTransition.transitionState).eq('entering'),
          w.meta('preference.reducedMotion').eq('no-preference'),
          w.prop('side').eq('bottom')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-top-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(true),
          w.state(behavior.asTransition.transitionState).eq('entering'),
          w.meta('preference.reducedMotion').eq('no-preference'),
          w.prop('side').eq('top')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-bottom-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(true),
          w.state(behavior.asTransition.transitionState).eq('entering'),
          w.meta('preference.reducedMotion').eq('no-preference'),
          w.prop('side').eq('left')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-right-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(true),
          w.state(behavior.asTransition.transitionState).eq('entering'),
          w.meta('preference.reducedMotion').eq('no-preference'),
          w.prop('side').eq('right')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-left-2')),
    });

    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(true),
          w.prop('material').eq('auto'),
          w.prop('variant').eq('regular')
        ),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(open).eq(true),
          w.prop('material').eq('auto'),
          w.prop('variant').eq('prominent')
        ),
      intent: (i) =>
        i.feedback.material.use({
          intent: 'liquid-glass',
          variant: 'regular',
          tint: 'style-fill',
        }),
    });
  },
});
