// Neutral opaque Surface projection. No material/glass or extra family component parity claim.
import { definePrototype, tw } from '@proto.ui/core';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonDefaultSurfaceSize,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';
import {
  asSurfaceRoot,
  type SurfaceRootProps,
  type SurfaceRootExposes,
} from '@proto.ui/prototypes-base/surface';
export interface Bootstrap232SurfaceRootProps extends SurfaceRootProps {
  /** Passive ordinary Button paint. The native owner supplies interaction facts. */
  actionProfile?: 'none' | 'button';
  /** Blue navbar transparent navigation only; ordinary surfaces retain their palette. */
  colorContext?: 'default' | 'navbar';
}
export const Bootstrap232SurfaceRoot = definePrototype<
  Bootstrap232SurfaceRootProps,
  SurfaceRootExposes
>({
  name: 'bootstrap-2-3-2-surface-root',
  setup(def) {
    const inherited = asSurfaceRoot();
    def.props.define({
      actionProfile: { type: 'enum', options: ['none', 'button'], empty: 'fallback' },
      colorContext: { type: 'enum', options: ['default', 'navbar'], empty: 'fallback' },
    });
    def.props.setDefaults({ actionProfile: 'none', colorContext: 'default' });
    // Presentation context is opt-in and applies only to transparent navigation.
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('variant').eq('scrim')),
      intent: (i) => i.feedback.style.use(tw('bg-black/80')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('fade').eq(true)),
      intent: (i) => i.feedback.style.use(tw('surface-fade')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(
            w.prop('fade').eq(true),
            w.any(w.prop('transitionState').eq('closed'), w.prop('transitionState').eq('leaving'))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('opacity-0')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(
            w.prop('fade').eq(true),
            w.any(w.prop('transitionState').eq('entering'), w.prop('transitionState').eq('entered'))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('opacity-100')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('radius').eq('default')),
      intent: (i) => i.feedback.style.use(tw('rounded-[4px]')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('radius').eq('none')),
      intent: (i) => i.feedback.style.use(tw('rounded-none')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('radius').eq('sm')),
      intent: (i) => i.feedback.style.use(tw('rounded-sm')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('radius').eq('md')),
      intent: (i) => i.feedback.style.use(tw('rounded-md')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('radius').eq('lg')),
      intent: (i) => i.feedback.style.use(tw('rounded-lg')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('radius').eq('xl')),
      intent: (i) => i.feedback.style.use(tw('rounded-xl')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('radius').eq('full')),
      intent: (i) => i.feedback.style.use(tw('rounded-full')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(
            w.prop('border').eq('all'),
            w.not(w.prop('variant').eq('solid')),
            w.not(w.all(w.prop('variant').eq('outline'), w.prop('elevation').eq('raised')))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('border border-border')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(
            w.prop('border').eq('all'),
            w.prop('variant').eq('outline'),
            w.prop('elevation').eq('raised')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('border border-[#ddd]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(w.prop('border').eq('all'), w.prop('variant').eq('solid'))
        ),
      intent: (i) => i.feedback.style.use(tw('border')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('border').eq('bottom')),
      intent: (i) => i.feedback.style.use(tw('border-b border-border')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('border').eq('none')),
      intent: (i) => i.feedback.style.use(tw('border-0')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('variant').eq('transparent'), w.prop('colorContext').eq('default')),
      intent: (i) => i.feedback.style.use(tw('bg-transparent text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('variant').eq('transparent'), w.prop('colorContext').eq('navbar')),
      // Paired with THEME navbar-foreground in both modes; never page foreground.
      intent: (i) => i.feedback.style.use(tw('bg-transparent text-white')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('variant').eq('transparent'), w.prop('colorContext').eq('navbar'), w.prop('focusVisible').eq(true)),
      intent: (i) => i.feedback.style.use(tw('forced-colors-focus-outline ring-2 ring-primary-foreground ring-offset-0')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('variant').eq('outline')),
      intent: (i) => i.feedback.style.use(tw('bg-background text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('variant').eq('secondary')),
      intent: (i) => i.feedback.style.use(tw('bg-secondary text-secondary-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('variant').eq('muted')),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('variant').eq('accent')),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('variant').eq('solid')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            bootstrapButtonRestFill.primary,
            'text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)]'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(
            w.prop('elevation').eq('raised'),
            w.not(w.any(w.prop('variant').eq('solid'), w.prop('variant').eq('outline')))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('shadow-sm')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(w.prop('variant').eq('outline'), w.prop('elevation').eq('raised'))
        ),
      intent: (i) => i.feedback.style.use(tw('shadow-[0_1px_3px_rgb(0_0_0/5.5%)]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(
            w.prop('variant').eq('solid'),
            w.prop('elevation').eq('raised'),
            w.prop('pressed').eq(false)
          )
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRaised)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(w.prop('variant').eq('solid'), w.prop('pressed').eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('focusVisible').eq(true), w.not(w.all(w.prop('variant').eq('transparent'), w.prop('colorContext').eq('navbar')))),
      intent: (i) =>
        i.feedback.style.use(
          tw('forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(
            w.prop('variant').eq('solid'),
            w.any(w.prop('hovered').eq(true), w.prop('focusVisible').eq(true)),
            w.prop('pressed').eq(false)
          )
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.primary)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(w.prop('variant').eq('solid'), w.prop('pressed').eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonFlatFill.primary)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(w.prop('pressed').eq(true), w.not(w.prop('variant').eq('solid')))
        ),
      intent: (i) => i.feedback.style.use(tw('translate-y-px shadow-none')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.all(
            w.any(w.prop('variant').eq('outline'), w.all(w.prop('variant').eq('transparent'), w.prop('colorContext').eq('default'))),
            w.any(w.prop('hovered').eq(true), w.prop('current').eq(true))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    // A passive .btn recipe, not a second Button protocol. Keep these Rules
    // exclusive with generic Surface paint so no card/thumbnail rule competes.
    def.rule({
      when: (w) => w.prop('actionProfile').eq('button'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            bootstrapButtonDefaultSurfaceSize,
            'inline-flex items-center justify-center border select-none'
          )
        ),
    });
    for (const [surfaceVariant, buttonVariant] of [
      ['solid', 'primary'],
      ['secondary', 'default'],
      ['outline', 'default'],
      ['muted', 'default'],
      ['accent', 'default'],
      ['scrim', 'default'],
    ] as const) {
      def.rule({
        when: (w) =>
          w.all(w.prop('actionProfile').eq('button'), w.prop('variant').eq(surfaceVariant)),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              buttonVariant === 'default'
                ? 'text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
                : 'text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)]'
            )
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('actionProfile').eq('button'),
            w.prop('variant').eq(surfaceVariant),
            w.prop('pressed').eq(false),
            w.prop('hovered').eq(false),
            w.prop('focusVisible').eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(tw(bootstrapButtonRestFill[buttonVariant], bootstrapButtonRaised)),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('actionProfile').eq('button'),
            w.prop('variant').eq(surfaceVariant),
            w.prop('pressed').eq(false),
            w.any(w.prop('hovered').eq(true), w.prop('focusVisible').eq(true))
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(bootstrapButtonInteractiveFill[buttonVariant], bootstrapButtonRaised)
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('actionProfile').eq('button'),
            w.prop('variant').eq(surfaceVariant),
            w.prop('pressed').eq(true),
            w.prop('hovered').eq(false),
            w.prop('focusVisible').eq(false)
          ),
        intent: (i) =>
          i.feedback.style.use(tw(bootstrapButtonFlatFill[buttonVariant], bootstrapButtonPressed)),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('actionProfile').eq('button'),
            w.prop('variant').eq(surfaceVariant),
            w.prop('pressed').eq(true),
            w.any(w.prop('hovered').eq(true), w.prop('focusVisible').eq(true))
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(bootstrapButtonPressedFill[buttonVariant], bootstrapButtonPressed)
          ),
      });
    }
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('button'), w.prop('variant').eq('transparent')),
      intent: (i) =>
        i.feedback.style.use(tw('bg-transparent text-foreground border-transparent shadow-none')),
    });
    def.rule({
      when: (w) => w.all(w.prop('actionProfile').eq('button'), w.prop('focusVisible').eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw('forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    return inherited.render;
  },
});
export default Bootstrap232SurfaceRoot;
