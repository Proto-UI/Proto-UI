import { definePrototype, tw } from '@proto.ui/core';
import { asButton } from '@proto.ui/prototypes-base/button';
import type {
  ShadcnButtonExposes,
  ShadcnButtonProps,
  ShadcnButtonSize,
  ShadcnButtonVariant,
} from './types';

// Shared button skeleton copied from shadcn/ui and reduced to the plain
// utility tokens that Proto UI v0 can express in feedback.style today.
const BUTTON_BASE_TOKENS = [
  'group/button',
  'inline-flex',
  'shrink-0',
  'items-center',
  'justify-center',
  'rounded-lg',
  'border',
  'bg-clip-padding',
  'text-sm',
  'font-medium',
  'transition-all',
  'outline-none',
  'select-none',
].join(' ');

// Variant rules stay composable and only encode the stable visual surface.
// Pseudo selectors such as hover/focus-visible/dark are left to
// dedicated rule extensions because the current feedback token contract does
// not accept selector-style utilities directly.
const VARIANT_TOKENS: Record<ShadcnButtonVariant, string> = {
  default: 'border-transparent bg-primary text-primary-foreground',
  destructive: 'border-transparent bg-destructive/10 text-destructive',
  outline: 'border-border bg-background text-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  ghost: 'border-transparent bg-transparent text-foreground',
  link: 'border-transparent bg-transparent text-primary underline-offset-4',
};

// Size rules cover the public API we expose right now. The upstream examples
// also contain xs-style variants, but those are not part of this prototype API
// yet, so they are intentionally left out here.
const SIZE_TOKENS: Record<ShadcnButtonSize, string> = {
  default: 'h-8 gap-1.5 px-2.5 whitespace-nowrap',
  sm: 'h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] whitespace-nowrap',
  lg: 'h-9 gap-1.5 px-2.5 whitespace-nowrap',
  icon: 'size-8 whitespace-nowrap',
};

const WRAP_SIZE_TOKENS = {
  default: 'min-h-8 h-auto gap-1.5 px-2.5 py-1 min-w-0 max-w-full whitespace-normal break-words',
  sm: 'min-h-7 h-auto gap-1 px-2.5 py-1 rounded-[min(var(--radius-md),12px)] text-[0.8rem] min-w-0 max-w-full whitespace-normal break-words',
  lg: 'min-h-9 h-auto gap-1.5 px-2.5 py-1 min-w-0 max-w-full whitespace-normal break-words',
} as const;

const button = definePrototype<ShadcnButtonProps, ShadcnButtonExposes>({
  name: 'shadcn-button',
  setup(def) {
    // P-SHADCN-BUTTON-VARIANT-PROP, P-SHADCN-BUTTON-SIZE-PROP
    def.props.define({
      variant: {
        type: 'enum',
        empty: 'fallback',
        options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      },
      size: { type: 'enum', empty: 'fallback', options: ['default', 'sm', 'lg', 'icon'] },
      disabled: { type: 'boolean', empty: 'fallback' },
      wrap: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({
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
    def.feedback.style.use(tw(BUTTON_BASE_TOKENS));

    // Variant surface rules map the public `variant` prop to visual tokens.
    (Object.keys(VARIANT_TOKENS) as ShadcnButtonVariant[]).forEach((variant) => {
      def.rule({
        when: (w) => w.prop('variant').eq(variant),
        intent: (i) => i.feedback.style.use(tw(VARIANT_TOKENS[variant])),
      });
    });

    // Size rules are isolated so later icon-density refinements can layer on
    // top without re-encoding every variant.
    (Object.keys(SIZE_TOKENS) as ShadcnButtonSize[]).forEach((size) => {
      def.rule({
        when: (w) =>
          size === 'icon'
            ? w.prop('size').eq(size)
            : w.all(w.prop('size').eq(size), w.prop('wrap').eq(false)),
        intent: (i) => i.feedback.style.use(tw(SIZE_TOKENS[size])),
      });
    });

    // Optional, reusable label wrapping. Fixed icon density is deliberately unchanged.
    for (const size of ['default', 'sm', 'lg'] as const) {
      def.rule({
        when: (w) => w.all(w.prop('size').eq(size), w.prop('wrap').eq(true)),
        intent: (i) => i.feedback.style.use(tw(WRAP_SIZE_TOKENS[size])),
      });
    }

    // P-SHADCN-BUTTON-INTERACTION-STYLES
    // Focus/press are shared interaction states exposed by `asButton()`, so
    // shadcn styling can stay inside rule semantics instead of hard-coding
    // host-specific pseudo selectors.
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
    });

    def.rule({
      when: (w) => w.all(w.state(focusVisible).eq(true), w.prop('variant').eq('destructive')),
      intent: (i) => i.feedback.style.use(tw('border-destructive/40 ring-destructive/20')),
    });

    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('translate-y-px')),
    });

    // Hovered surface rules are split by variant so later dark/meta branches
    // can replace them cleanly without duplicating the base variant tokens.
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('default')),
      intent: (i) => i.feedback.style.use(tw('bg-primary/80')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('secondary')),
      intent: (i) => i.feedback.style.use(tw('bg-secondary/80')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('outline')),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('ghost')),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('link')),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.prop('variant').eq('destructive')),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
    });

    // P-SHADCN-BUTTON-COLOR-SCHEME-STYLES
    // Dark mode stays in meta so the prototype remains host-agnostic while web
    // adapters still have a clean place to optimize to `dark:*`.
    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.prop('variant').eq('outline')),
      intent: (i) => i.feedback.style.use(tw('border-input bg-input/30')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.meta('colorScheme').eq('dark'),
          w.state(hovered).eq(true),
          w.prop('variant').eq('outline')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.prop('variant').eq('destructive')),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.meta('colorScheme').eq('dark'),
          w.state(hovered).eq(true),
          w.prop('variant').eq('destructive')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/30')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.meta('colorScheme').eq('dark'),
          w.state(focusVisible).eq(true),
          w.prop('variant').eq('destructive')
        ),
      intent: (i) => i.feedback.style.use(tw('ring-destructive/40')),
    });
    // Disabled remains a standalone rule because it semantically cuts across
    // every variant and size, and we now source it from the shared button
    // behavior instead of duplicating prop semantics locally.
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
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
