// Neutral opaque Surface projection. No material/glass or extra family component parity claim.
import { definePrototype, tw } from '@proto.ui/core';
import {
  bootstrapButtonFill,
  bootstrapButtonActiveFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';
import {
  asSurfaceRoot,
  type SurfaceRootProps,
  type SurfaceRootExposes,
} from '@proto.ui/prototypes-base/surface';
export const Bootstrap232SurfaceRoot = definePrototype<SurfaceRootProps, SurfaceRootExposes>({
  name: 'bootstrap-2-3-2-surface-root',
  setup(def) {
    asSurfaceRoot();
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
      intent: (i) => i.feedback.style.use(tw('rounded-[4px]')),
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
      when: (w) =>
        w.all(
          w.prop('border').eq('all'),
          w.not(w.prop('variant').eq('solid')),
          w.not(w.all(w.prop('variant').eq('outline'), w.prop('elevation').eq('raised')))
        ),
      intent: (i) => i.feedback.style.use(tw('border border-border')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('border').eq('all'),
          w.prop('variant').eq('outline'),
          w.prop('elevation').eq('raised')
        ),
      intent: (i) => i.feedback.style.use(tw('border border-[#ddd]')),
    });
    def.rule({
      when: (w) => w.all(w.prop('border').eq('all'), w.prop('variant').eq('solid')),
      intent: (i) => i.feedback.style.use(tw('border')),
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
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonFill.primary)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('elevation').eq('raised'),
          w.not(w.any(w.prop('variant').eq('solid'), w.prop('variant').eq('outline')))
        ),
      intent: (i) => i.feedback.style.use(tw('shadow-sm')),
    });
    def.rule({
      when: (w) => w.all(w.prop('variant').eq('outline'), w.prop('elevation').eq('raised')),
      intent: (i) => i.feedback.style.use(tw('shadow-[0_1px_3px_rgb(0_0_0/5.5%)]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('solid'),
          w.prop('elevation').eq('raised'),
          w.prop('pressed').eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRaised)),
    });
    def.rule({
      when: (w) => w.all(w.prop('variant').eq('solid'), w.prop('pressed').eq(true)),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) => w.prop('focusVisible').eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('solid'),
          w.any(w.prop('hovered').eq(true), w.prop('pressed').eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonActiveFill.primary)),
    });
    def.rule({
      when: (w) => w.all(w.prop('pressed').eq(true), w.not(w.prop('variant').eq('solid'))),
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
export default Bootstrap232SurfaceRoot;
