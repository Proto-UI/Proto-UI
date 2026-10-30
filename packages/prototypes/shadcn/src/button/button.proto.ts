import { definePrototype, tw } from '@proto.ui/core';
import { asButton } from '@proto.ui/prototypes-base/button';
import { SHADCN_STYLE_IDS, setupShadcnStyleSelection } from '../style-scope';
import type {
  ShadcnButtonExposes,
  ShadcnButtonProps,
  ShadcnButtonSize,
  ShadcnButtonVariant,
} from './types';
import { NEW_YORK_BASE, NEW_YORK_VARIANTS, NEW_YORK_SIZES, NEW_YORK_WRAP_SIZES } from './new-york';
import { SHADCN_BUTTON_DISABLED_TOKENS } from './paint';
import {
  SHADCN_ACTION_BASE,
  SHADCN_ACTION_TEXT,
  SHADCN_ACTION_FOCUS,
  SHADCN_ACTION_RADIUS,
  SHADCN_ACTION_SIZES,
  SHADCN_ACTION_WRAP_SIZES,
  SHADCN_BUTTON_OUTLINE,
  SHADCN_BUTTON_OUTLINE_HOVER,
  SHADCN_MODERN_ACTION_STYLES,
  SHADCN_SECONDARY_HOVER,
} from './profiles';

// Modern variants with source-identical paint; outline and Sera link have
// separate declarations below, not a renamed Rhea/Nova fallback.
const VARIANT_TOKENS: Record<Exclude<ShadcnButtonVariant, 'outline'>, string> = {
  default: 'bg-primary text-primary-foreground',
  destructive: 'border-transparent bg-destructive/10 text-destructive',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  ghost: 'border-transparent bg-transparent text-foreground',
  link: 'border-transparent bg-transparent text-primary underline-offset-4',
};

const button = definePrototype<ShadcnButtonProps, ShadcnButtonExposes>({
  name: 'shadcn-button',
  setup(def) {
    def.props.define({
      variant: {
        type: 'enum',
        empty: 'fallback',
        options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      },
      size: {
        type: 'enum',
        empty: 'fallback',
        options: ['default', 'sm', 'lg', 'icon', 'icon-compact'],
      },
      disabled: { type: 'boolean', empty: 'fallback' },
      wrap: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'default', size: 'default', disabled: false, wrap: false });

    // Base remains the only activation/focus/disabled/press owner.
    const buttonState = asButton().stateHandles;
    if (!buttonState) {
      throw new Error('[shadcn-button] asButton must project Button state handles.');
    }
    const { disabled, hovered, focusVisible, pressed } = buttonState;
    // No concrete prop default: explicit -> nearest scope -> existing Rhea.
    const style = setupShadcnStyleSelection(def, 'rhea', { supportedStyles: SHADCN_STYLE_IDS });

    def.rule({
      when: (w) => w.not(w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_BASE)),
    });
    for (const variant of Object.keys(VARIANT_TOKENS) as Array<
      Exclude<ShadcnButtonVariant, 'outline'>
    >) {
      def.rule({
        when: (w) => w.all(w.not(w.state(style).eq('new-york-v4')), w.prop('variant').eq(variant)),
        intent: (i) => i.feedback.style.use(tw(VARIANT_TOKENS[variant])),
      });
    }
    for (const profile of SHADCN_MODERN_ACTION_STYLES) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_TEXT[profile])),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.not(w.prop('size').eq('icon-compact'))),
        intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_RADIUS[profile])),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('outline')),
        intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_OUTLINE[profile])),
      });
      for (const size of ['default', 'sm', 'lg', 'icon', 'icon-compact'] as const) {
        if (size === 'icon' || size === 'icon-compact') {
          def.rule({
            when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq(size)),
            intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_SIZES[`${profile}-${size}`])),
          });
        } else {
          def.rule({
            when: (w) =>
              w.all(w.state(style).eq(profile), w.prop('size').eq(size), w.prop('wrap').eq(false)),
            intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_SIZES[`${profile}-${size}`])),
          });
          def.rule({
            when: (w) =>
              w.all(w.state(style).eq(profile), w.prop('size').eq(size), w.prop('wrap').eq(true)),
            intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_WRAP_SIZES[`${profile}-${size}`])),
          });
        }
      }
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_FOCUS[profile])),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(hovered).eq(true),
            w.prop('variant').eq('outline')
          ),
        intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_OUTLINE_HOVER[profile])),
      });
    }
    def.rule({
      when: (w) => w.all(w.state(style).eq('sera'), w.prop('variant').eq('link')),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.state(focusVisible).eq(true),
          w.prop('variant').eq('destructive')
        ),
      intent: (i) => i.feedback.style.use(tw('border-destructive/40 ring-destructive/20')),
    });
    def.rule({
      when: (w) => w.all(w.not(w.state(style).eq('new-york-v4')), w.state(pressed).eq(true)),
      intent: (i) => i.feedback.style.use(tw('translate-y-px')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.state(hovered).eq(true),
          w.prop('variant').eq('default')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary/80')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.state(hovered).eq(true),
          w.prop('variant').eq('secondary')
        ),
      intent: (i) => i.feedback.style.use(tw(SHADCN_SECONDARY_HOVER)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.state(hovered).eq(true),
          w.prop('variant').eq('ghost')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.state(hovered).eq(true),
          w.prop('variant').eq('link')
        ),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.state(hovered).eq(true),
          w.prop('variant').eq('destructive')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
    });
    // Source-specific dark outlines. Each hover branch follows its rest branch
    // so the latter cannot mask an already hovered Mira surface.
    for (const profile of ['vega', 'nova', 'lyra'] as const) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark'),
            w.prop('variant').eq('outline')
          ),
        intent: (i) => i.feedback.style.use(tw('border-input bg-input/30')),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark'),
            w.state(hovered).eq(true),
            w.prop('variant').eq('outline')
          ),
        intent: (i) => i.feedback.style.use(tw('bg-input/50')),
      });
    }
    for (const profile of ['luma', 'rhea'] as const) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark'),
            w.prop('variant').eq('outline')
          ),
        intent: (i) => i.feedback.style.use(tw('bg-transparent')),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark'),
            w.state(hovered).eq(true),
            w.prop('variant').eq('outline')
          ),
        intent: (i) => i.feedback.style.use(tw('bg-input/30')),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('mira'),
          w.meta('colorScheme').eq('dark'),
          w.prop('variant').eq('outline')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('mira'),
          w.meta('colorScheme').eq('dark'),
          w.state(hovered).eq(true),
          w.prop('variant').eq('outline')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('sera'),
          w.meta('colorScheme').eq('dark'),
          w.state(hovered).eq(true),
          w.prop('variant').eq('outline')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.meta('colorScheme').eq('dark'),
          w.prop('variant').eq('destructive')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.meta('colorScheme').eq('dark'),
          w.state(hovered).eq(true),
          w.prop('variant').eq('destructive')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/30')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.meta('colorScheme').eq('dark'),
          w.state(focusVisible).eq(true),
          w.prop('variant').eq('destructive')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-destructive/40')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.meta('colorScheme').eq('dark'),
          w.state(hovered).eq(true),
          w.prop('variant').eq('ghost')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
    });

    // Independently pinned 02cad611 direct legacy recipe, never modern paint.
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw(NEW_YORK_BASE)),
    });
    for (const variant of Object.keys(NEW_YORK_VARIANTS) as ShadcnButtonVariant[]) {
      def.rule({
        when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('variant').eq(variant)),
        intent: (i) => i.feedback.style.use(tw(NEW_YORK_VARIANTS[variant])),
      });
    }
    for (const size of ['default', 'sm', 'lg', 'icon', 'icon-compact'] as const) {
      if (size === 'icon' || size === 'icon-compact') {
        def.rule({
          when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('size').eq(size)),
          intent: (i) => i.feedback.style.use(tw(NEW_YORK_SIZES[size])),
        });
      } else {
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq('new-york-v4'),
              w.prop('size').eq(size),
              w.prop('wrap').eq(false)
            ),
          intent: (i) => i.feedback.style.use(tw(NEW_YORK_SIZES[size])),
        });
        def.rule({
          when: (w) =>
            w.all(
              w.state(style).eq('new-york-v4'),
              w.prop('size').eq(size),
              w.prop('wrap').eq(true)
            ),
          intent: (i) => i.feedback.style.use(tw(NEW_YORK_WRAP_SIZES[size])),
        });
      }
    }
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(focusVisible).eq(true),
          w.prop('variant').eq('destructive')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-destructive/20')),
    });
    const legacyHover = {
      default: 'bg-primary/90',
      destructive: 'bg-destructive/90',
      outline: 'bg-accent text-accent-foreground',
      secondary: 'bg-secondary/80',
      ghost: 'bg-accent text-accent-foreground',
      link: 'underline',
    } as const;
    for (const variant of Object.keys(legacyHover) as ShadcnButtonVariant[]) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq('new-york-v4'),
            w.state(hovered).eq(true),
            w.prop('variant').eq(variant)
          ),
        intent: (i) => i.feedback.style.use(tw(legacyHover[variant])),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.meta('colorScheme').eq('dark'),
          w.prop('variant').eq('outline')
        ),
      intent: (i) => i.feedback.style.use(tw('border-input bg-input/30')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.meta('colorScheme').eq('dark'),
          w.state(hovered).eq(true),
          w.prop('variant').eq('outline')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.meta('colorScheme').eq('dark'),
          w.prop('variant').eq('destructive')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/60')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.meta('colorScheme').eq('dark'),
          w.state(focusVisible).eq(true),
          w.prop('variant').eq('destructive')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-destructive/40')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.meta('colorScheme').eq('dark'),
          w.state(hovered).eq(true),
          w.prop('variant').eq('ghost')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent/50')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DISABLED_TOKENS)),
    });
  },
});

/** Draft bounded source projection, not full upstream API/native/selector parity.
 * asChild, native forwarding, invalid/expanded/glyph selectors and extra sizes
 * retain their independent P-SHADCN-BUTTON compatibility boundary.
 */
export type { ShadcnButtonProps, ShadcnButtonExposes, ShadcnButtonSize, ShadcnButtonVariant };
export default button;
