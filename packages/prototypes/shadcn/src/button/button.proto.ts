import { definePrototype, tw } from '@proto.ui/core';
import { asButton } from '@proto.ui/prototypes-base/button';
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
  SHADCN_ACTION_FOCUS,
  SHADCN_ACTION_RADIUS,
  SHADCN_ACTION_SIZES,
  SHADCN_ACTION_WRAP_SIZES,
  SHADCN_SECONDARY_HOVER,
} from './profiles';

// Variant rules stay composable and only encode the stable visual surface.
// Pseudo selectors such as hover/focus-visible/dark are left to
// dedicated rule extensions because the current feedback token contract does
// not accept selector-style utilities directly.
const VARIANT_TOKENS: Record<ShadcnButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground',
  destructive: 'border-transparent bg-destructive/10 text-destructive',
  outline: 'border-border bg-background text-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  ghost: 'border-transparent bg-transparent text-foreground',
  link: 'border-transparent bg-transparent text-primary underline-offset-4',
};

const button = definePrototype<ShadcnButtonProps, ShadcnButtonExposes>({
  name: 'shadcn-button',
  setup(def) {
    // P-SHADCN-BUTTON-VARIANT-PROP, P-SHADCN-BUTTON-SIZE-PROP
    def.props.define({
      styleProfile: { type: 'enum', empty: 'fallback', options: ['rhea', 'luma', 'new-york'] },
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
    def.props.setDefaults({
      styleProfile: 'rhea',
      variant: 'default',
      size: 'default',
      disabled: false,
      wrap: false,
    });

    // P-SHADCN-BUTTON-BASE-INHERITANCE,
    // P-SHADCN-BUTTON-CURRENT-BASE-DEVIATIONS
    // The current projection keeps every asButton-introduced behavior. A future
    // setup-only negative patch must first be declared as a P-entity deviation.
    const buttonState = asButton().stateHandles;
    if (!buttonState) {
      throw new Error('[shadcn-button] asButton must project Button state handles.');
    }
    const { disabled, hovered, focusVisible, pressed } = buttonState;

    // P-SHADCN-BUTTON-DIRECT-ENTRY
    // Base skeleton shared by every shadcn-style button.
    def.rule({
      when: (w) => w.not(w.prop('styleProfile').eq('new-york')),
      intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_BASE)),
    });

    // Variant surface rules map the public `variant` prop to visual tokens.
    (Object.keys(VARIANT_TOKENS) as ShadcnButtonVariant[]).forEach((variant) => {
      def.rule({
        when: (w) =>
          w.all(w.not(w.prop('styleProfile').eq('new-york')), w.prop('variant').eq(variant)),
        intent: (i) => i.feedback.style.use(tw(VARIANT_TOKENS[variant])),
      });
    });

    for (const profile of ['rhea', 'luma'] as const) {
      def.rule({
        when: (w) =>
          w.all(w.prop('styleProfile').eq(profile), w.not(w.prop('size').eq('icon-compact'))),
        intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_RADIUS[profile])),
      });
      for (const size of ['default', 'sm', 'lg', 'icon', 'icon-compact'] as const) {
        if (size === 'icon' || size === 'icon-compact') {
          def.rule({
            when: (w) => w.all(w.prop('styleProfile').eq(profile), w.prop('size').eq(size)),
            intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_SIZES[`${profile}-${size}`])),
          });
        } else {
          def.rule({
            when: (w) =>
              w.all(
                w.prop('styleProfile').eq(profile),
                w.prop('size').eq(size),
                w.prop('wrap').eq(false)
              ),
            intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_SIZES[`${profile}-${size}`])),
          });
          def.rule({
            when: (w) =>
              w.all(
                w.prop('styleProfile').eq(profile),
                w.prop('size').eq(size),
                w.prop('wrap').eq(true)
              ),
            intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_WRAP_SIZES[`${profile}-${size}`])),
          });
        }
      }
    }

    // P-SHADCN-BUTTON-INTERACTION-STYLES
    // Focus/press are shared interaction states exposed by `asButton()`, so
    // shadcn styling can stay inside rule semantics instead of hard-coding
    // host-specific pseudo selectors.
    def.rule({
      when: (w) =>
        w.all(w.not(w.prop('styleProfile').eq('new-york')), w.state(focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_FOCUS)),
    });

    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(w.state(focusVisible).eq(true), w.prop('variant').eq('destructive'))
        ),
      intent: (i) => i.feedback.style.use(tw('border-destructive/40 ring-destructive/20')),
    });

    def.rule({
      when: (w) => w.all(w.not(w.prop('styleProfile').eq('new-york')), w.state(pressed).eq(true)),
      intent: (i) => i.feedback.style.use(tw('translate-y-px')),
    });

    // Hovered surface rules are split by variant so later dark/meta branches
    // can replace them cleanly without duplicating the base variant tokens.
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('default'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary/80')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('secondary'))
        ),
      intent: (i) => i.feedback.style.use(tw(SHADCN_SECONDARY_HOVER)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('outline'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('ghost'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('link'))
        ),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('destructive'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
    });

    // P-SHADCN-BUTTON-COLOR-SCHEME-STYLES
    // Dark mode stays in meta so the prototype remains host-agnostic while web
    // adapters still have a clean place to optimize to `dark:*`.
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(w.meta('colorScheme').eq('dark'), w.prop('variant').eq('outline'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-transparent')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(
            w.meta('colorScheme').eq('dark'),
            w.state(hovered).eq(true),
            w.prop('variant').eq('outline')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(w.meta('colorScheme').eq('dark'), w.prop('variant').eq('destructive'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(
            w.meta('colorScheme').eq('dark'),
            w.state(hovered).eq(true),
            w.prop('variant').eq('destructive')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/30')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(
            w.meta('colorScheme').eq('dark'),
            w.state(focusVisible).eq(true),
            w.prop('variant').eq('destructive')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('ring-destructive/40')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.prop('styleProfile').eq('new-york')),
          w.all(
            w.meta('colorScheme').eq('dark'),
            w.state(hovered).eq(true),
            w.prop('variant').eq('ghost')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
    });
    // Explicit legacy profile, not an override of modern recipes or compound paint.
    def.rule({
      when: (w) => w.prop('styleProfile').eq('new-york'),
      intent: (i) => i.feedback.style.use(tw(NEW_YORK_BASE)),
    });
    for (const variant of Object.keys(NEW_YORK_VARIANTS) as ShadcnButtonVariant[]) {
      def.rule({
        when: (w) => w.all(w.prop('styleProfile').eq('new-york'), w.prop('variant').eq(variant)),
        intent: (i) => i.feedback.style.use(tw(NEW_YORK_VARIANTS[variant])),
      });
    }
    for (const size of ['default', 'sm', 'lg', 'icon', 'icon-compact'] as const) {
      if (size === 'icon' || size === 'icon-compact') {
        def.rule({
          when: (w) => w.all(w.prop('styleProfile').eq('new-york'), w.prop('size').eq(size)),
          intent: (i) => i.feedback.style.use(tw(NEW_YORK_SIZES[size])),
        });
      } else {
        def.rule({
          when: (w) =>
            w.all(
              w.prop('styleProfile').eq('new-york'),
              w.prop('size').eq(size),
              w.prop('wrap').eq(false)
            ),
          intent: (i) => i.feedback.style.use(tw(NEW_YORK_SIZES[size])),
        });
        def.rule({
          when: (w) =>
            w.all(
              w.prop('styleProfile').eq('new-york'),
              w.prop('size').eq(size),
              w.prop('wrap').eq(true)
            ),
          intent: (i) => i.feedback.style.use(tw(NEW_YORK_WRAP_SIZES[size])),
        });
      }
    }
    def.rule({
      when: (w) => w.all(w.prop('styleProfile').eq('new-york'), w.state(focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(w.state(focusVisible).eq(true), w.prop('variant').eq('destructive'))
        ),
      intent: (i) => i.feedback.style.use(tw('ring-destructive/20')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('default'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary/90')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('secondary'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary/80')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('outline'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('ghost'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('link'))
        ),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(w.state(hovered).eq(true), w.prop('variant').eq('destructive'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/90')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(w.meta('colorScheme').eq('dark'), w.prop('variant').eq('outline'))
        ),
      intent: (i) => i.feedback.style.use(tw('border-input bg-input/30')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(
            w.meta('colorScheme').eq('dark'),
            w.state(hovered).eq(true),
            w.prop('variant').eq('outline')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(w.meta('colorScheme').eq('dark'), w.prop('variant').eq('destructive'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/60')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(
            w.meta('colorScheme').eq('dark'),
            w.state(focusVisible).eq(true),
            w.prop('variant').eq('destructive')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('ring-destructive/40')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('styleProfile').eq('new-york'),
          w.all(
            w.meta('colorScheme').eq('dark'),
            w.state(hovered).eq(true),
            w.prop('variant').eq('ghost')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent/50')),
    });
    // Disabled remains a standalone rule because it semantically cuts across
    // every variant and size, and we now source it from the shared button
    // behavior instead of duplicating prop semantics locally.
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DISABLED_TOKENS)),
    });
  },
});

/**
 * P-SHADCN-BUTTON-COMPATIBILITY-SUBSET:
 * The one catalog open question centralizes every upstream difference.
 * P-SHADCN-BUTTON-AS-CHILD-OMISSION is intentional under D-AS-CHILD-OMISSION-0001;
 * native/className forwarding, aria-invalid/nested-svg selectors, extra sizes,
 * and exact token parity remain implementation or review gaps.
 */

export type { ShadcnButtonProps, ShadcnButtonExposes, ShadcnButtonSize, ShadcnButtonVariant };
export default button;
