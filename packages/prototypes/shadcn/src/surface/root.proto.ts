import { definePrototype, tw } from '@proto.ui/core';
import {
  asSurfaceRoot,
  type SurfaceRootProps,
  type SurfaceRootExposes,
} from '@proto.ui/prototypes-base/surface';
import {
  SHADCN_ACTION_RADIUS,
  SHADCN_ACTION_FOCUS,
  SHADCN_SECONDARY_HOVER,
} from '../button/profiles';
import type { ShadcnActionStyleProfile } from '../button/types';
import { SHADCN_STYLE_IDS } from '../style-scope';

export interface ShadcnSurfaceRootProps extends SurfaceRootProps {
  /** Explicit passive appearance only; scope alone never turns a content Surface into an action. */
  actionProfile?: 'none' | ShadcnActionStyleProfile;
}
// Opted-in chrome is the source-bound Button default/secondary/ghost recipe
// in ../button/profiles.ts and independent New York, never an interaction hook.
export const ShadcnSurfaceRoot = definePrototype<ShadcnSurfaceRootProps, SurfaceRootExposes>({
  name: 'shadcn-surface-root',
  setup(def) {
    asSurfaceRoot();
    def.props.define({
      actionProfile: {
        type: 'enum',
        empty: 'fallback',
        options: ['none', ...SHADCN_STYLE_IDS, 'new-york'],
      },
    });
    def.props.setDefaults({ actionProfile: 'none' });
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
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('radius').eq('default')),
      intent: (i) => i.feedback.style.use(tw('rounded-xl')),
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
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('border').eq('all')),
      intent: (i) => i.feedback.style.use(tw('border border-border')),
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
      when: (w) => w.all(w.prop('actionProfile').eq('none'), w.prop('focusVisible').eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw('forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.prop('variant').eq('solid'),
          w.prop('hovered').eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary/80')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('pressed').eq(true),
          w.not(
            w.any(w.prop('actionProfile').eq('new-york-v4'), w.prop('actionProfile').eq('new-york'))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('translate-y-px shadow-none')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('actionProfile').eq('none'),
          w.any(w.prop('variant').eq('outline'), w.prop('variant').eq('transparent')),
          w.any(w.prop('hovered').eq(true), w.prop('current').eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    for (const profile of [...SHADCN_STYLE_IDS, 'new-york'] as const) {
      def.rule({
        when: (w) => w.prop('actionProfile').eq(profile),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4' || profile === 'new-york'
                ? 'transition-all outline-none'
                : 'border border-transparent bg-clip-padding transition-all outline-none',
              SHADCN_ACTION_RADIUS[profile]
            )
          ),
      });
      def.rule({
        when: (w) => w.all(w.prop('actionProfile').eq(profile), w.prop('focusVisible').eq(true)),
        intent: (i) =>
          i.feedback.style.use(tw('forced-colors-focus-outline', SHADCN_ACTION_FOCUS[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('actionProfile').eq(profile),
            w.prop('variant').eq('solid'),
            w.prop('hovered').eq(true)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4' || profile === 'new-york'
                ? 'bg-primary/90'
                : 'bg-primary/80'
            )
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('actionProfile').eq(profile),
            w.prop('variant').eq('secondary'),
            w.prop('hovered').eq(true)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4' || profile === 'new-york'
                ? 'bg-secondary/80'
                : SHADCN_SECONDARY_HOVER
            )
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('actionProfile').eq(profile),
            w.prop('variant').eq('transparent'),
            w.prop('hovered').eq(true)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4' || profile === 'new-york'
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-foreground'
            )
          ),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.prop('actionProfile').eq(profile),
            w.prop('variant').eq('transparent'),
            w.prop('hovered').eq(true),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(profile === 'new-york-v4' || profile === 'new-york' ? 'bg-accent/50' : 'bg-muted/50')
          ),
      });
    }
    return (renderer) => renderer.r.slot();
  },
});
export default ShadcnSurfaceRoot;
