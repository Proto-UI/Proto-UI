// Static optical surface intent. Unavailable or nonopaque source/style inputs preserve the ordinary Surface presentation.
import { definePrototype, tw } from '@proto.ui/core';
import {
  asSurfaceRoot,
  type SurfaceRootProps,
  type SurfaceRootExposes,
} from '@proto.ui/prototypes-base/surface';
export const LiquidGlassSurfaceRoot = definePrototype<SurfaceRootProps, SurfaceRootExposes>({
  name: 'liquid-glass-surface-root',
  setup(def) {
    asSurfaceRoot();
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) =>
        w.any(
          w.prop('variant').eq('outline'),
          w.prop('variant').eq('secondary'),
          w.prop('variant').eq('muted')
        ),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular' }),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('scrim'),
      intent: (i) => i.feedback.style.use(tw('bg-black/80')),
    });
    def.rule({
      when: (w) => w.prop('fade').eq(true),
      intent: (i) => i.feedback.style.use(tw('surface-fade')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('fade').eq(true),
          w.any(w.prop('transitionState').eq('closed'), w.prop('transitionState').eq('leaving'))
        ),
      intent: (i) => i.feedback.style.use(tw('opacity-0')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('fade').eq(true),
          w.any(w.prop('transitionState').eq('entering'), w.prop('transitionState').eq('entered'))
        ),
      intent: (i) => i.feedback.style.use(tw('opacity-100')),
    });
    def.rule({
      when: (w) => w.prop('radius').eq('default'),
      intent: (i) => i.feedback.style.use(tw('rounded-none')),
    });
    def.rule({
      when: (w) => w.prop('radius').eq('none'),
      intent: (i) => i.feedback.style.use(tw('rounded-none')),
    });
    def.rule({
      when: (w) => w.prop('radius').eq('sm'),
      intent: (i) => i.feedback.style.use(tw('rounded-sm')),
    });
    def.rule({
      when: (w) => w.prop('radius').eq('md'),
      intent: (i) => i.feedback.style.use(tw('rounded-md')),
    });
    def.rule({
      when: (w) => w.prop('radius').eq('lg'),
      intent: (i) => i.feedback.style.use(tw('rounded-lg')),
    });
    def.rule({
      when: (w) => w.prop('radius').eq('xl'),
      intent: (i) => i.feedback.style.use(tw('rounded-xl')),
    });
    def.rule({
      when: (w) => w.prop('radius').eq('full'),
      intent: (i) => i.feedback.style.use(tw('rounded-full')),
    });
    def.rule({
      when: (w) => w.prop('border').eq('all'),
      intent: (i) => i.feedback.style.use(tw('border border-border')),
    });
    def.rule({
      when: (w) => w.prop('border').eq('bottom'),
      intent: (i) => i.feedback.style.use(tw('border-b border-border')),
    });
    def.rule({
      when: (w) => w.prop('border').eq('none'),
      intent: (i) => i.feedback.style.use(tw('border-0')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('transparent'),
      intent: (i) => i.feedback.style.use(tw('bg-transparent text-foreground')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('outline'),
      intent: (i) => i.feedback.style.use(tw('bg-background text-foreground')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('secondary'),
      intent: (i) => i.feedback.style.use(tw('bg-secondary text-secondary-foreground')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('muted'),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('accent'),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('solid'),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.prop('elevation').eq('raised'),
      intent: (i) => i.feedback.style.use(tw('shadow-sm')),
    });
    def.rule({
      when: (w) => w.prop('focusVisible').eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.all(w.prop('variant').eq('solid'), w.prop('hovered').eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-primary/80')),
    });
    def.rule({
      when: (w) => w.prop('pressed').eq(true),
      intent: (i) => i.feedback.style.use(tw('translate-y-px shadow-none')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.any(w.prop('variant').eq('outline'), w.prop('variant').eq('transparent')),
          w.any(w.prop('hovered').eq(true), w.prop('current').eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    return (renderer) => renderer.r.slot();
  },
});
export default LiquidGlassSurfaceRoot;
