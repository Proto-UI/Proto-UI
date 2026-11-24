import { definePrototype, tw } from '@proto.ui/core';
import { asButton } from '@proto.ui/prototypes-base/button';
import {
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_HOVER_LIFT_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
  BRUTALIST_PRESS_TOKENS,
  BRUTALIST_STRUCTURE_TOKENS,
} from '../style';
import type {
  BrutalistButtonColor,
  BrutalistButtonExposes,
  BrutalistButtonProps,
  BrutalistButtonSize,
  BrutalistButtonVariant,
} from './types';

// P-BRUTALIST-BUTTON-VISUAL-GRAMMAR
const BUTTON_BASE_TOKENS = [
  'group/brutalist-button',
  'inline-flex',
  'shrink-0',
  'items-center',
  'justify-center',
  'gap-2',
  'font-sans',
  'font-medium',
  BRUTALIST_STRUCTURE_TOKENS,
].join(' ');

/**
 * Solid accent pairs. Background and foreground are always co-selected.
 * Accent foreground stays ink (`*-foreground` = black) in both Light and Dark.
 * P-BRUTALIST-BUTTON-COLOR-PROP, P-BRUTALIST-BUTTON-PAIR-INVARIANT
 */
const SOLID_COLOR_TOKENS: Record<BrutalistButtonColor, string> = {
  main: `${BRUTALIST_STRUCTURE_TOKENS} bg-main text-main-foreground`,
  mint: `${BRUTALIST_STRUCTURE_TOKENS} bg-mint text-mint-foreground`,
  lavender: `${BRUTALIST_STRUCTURE_TOKENS} bg-lavender text-lavender-foreground`,
  coral: `${BRUTALIST_STRUCTURE_TOKENS} bg-coral text-coral-foreground`,
  sky: `${BRUTALIST_STRUCTURE_TOKENS} bg-sky text-sky-foreground`,
};

/**
 * Non-accent fill roles. Surface uses theme CSS variables so a host theme change
 * updates mounted controls without a pointer refresh.
 * P-BRUTALIST-BUTTON-VARIANT-PROP, P-BRUTALIST-BUTTON-PAIR-INVARIANT,
 * P-BRUTALIST-BUTTON-LIVE-THEME
 */
const VARIANT_FILL_TOKENS: Record<'surface' | 'destructive', string> = {
  surface: `${BRUTALIST_STRUCTURE_TOKENS} bg-secondary-background text-foreground`,
  destructive: `${BRUTALIST_STRUCTURE_TOKENS} bg-destructive text-destructive-foreground`,
};

/** Flat no-shadow accent pairs matching neobrutalism.dev's `noShadow` variant. */
const NO_SHADOW_COLOR_TOKENS: Record<BrutalistButtonColor, string> = {
  main: 'bg-main text-main-foreground shadow-none',
  mint: 'bg-mint text-mint-foreground shadow-none',
  lavender: 'bg-lavender text-lavender-foreground shadow-none',
  coral: 'bg-coral text-coral-foreground shadow-none',
  sky: 'bg-sky text-sky-foreground shadow-none',
};

// P-BRUTALIST-BUTTON-SIZE-PROP
const SIZE_TOKENS: Record<BrutalistButtonSize, string> = {
  default: 'h-10 px-4 text-sm whitespace-nowrap',
  xs: 'h-6 px-2.5 text-xs whitespace-nowrap',
  sm: 'h-9 px-3 text-sm whitespace-nowrap',
  lg: 'h-11 px-8 text-sm whitespace-nowrap',
  icon: 'size-10 whitespace-nowrap',
  'icon-xs': 'h-6 w-6 whitespace-nowrap',
  'icon-sm': 'size-9 whitespace-nowrap',
  'icon-lg': 'h-11 aspect-square whitespace-nowrap',
};

const ICON_SIZES = new Set<BrutalistButtonSize>(['icon', 'icon-xs', 'icon-sm', 'icon-lg']);

// Proto UI opt-in multiline extension. Pinned default geometry remains unchanged.
const WRAP_SIZE_TOKENS = {
  default:
    'min-h-10 h-auto px-4 py-1 text-sm whitespace-normal min-w-0 max-w-full wrap-anywhere text-center',
  xs: 'min-h-6 h-auto px-2.5 py-0.5 text-xs whitespace-normal min-w-0 max-w-full wrap-anywhere text-center',
  sm: 'min-h-9 h-auto px-3 py-1 text-sm whitespace-normal min-w-0 max-w-full wrap-anywhere text-center',
  lg: 'min-h-11 h-auto px-8 py-1 text-sm whitespace-normal min-w-0 max-w-full wrap-anywhere text-center',
} as const;

const button = definePrototype<BrutalistButtonProps, BrutalistButtonExposes>({
  // P-BRUTALIST-BUTTON-ENTRY
  name: 'brutalist-button',
  setup(def) {
    // P-BRUTALIST-BUTTON-VARIANT-PROP, P-BRUTALIST-BUTTON-COLOR-PROP, P-BRUTALIST-BUTTON-SIZE-PROP
    def.props.define({
      variant: {
        type: 'enum',
        empty: 'fallback',
        options: ['solid', 'surface', 'destructive', 'noShadow'],
      },
      color: {
        type: 'enum',
        empty: 'fallback',
        options: ['main', 'mint', 'lavender', 'coral', 'sky'],
      },
      size: {
        type: 'enum',
        empty: 'fallback',
        options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
      },
      wrap: { type: 'boolean', empty: 'fallback' },
      // P-BRUTALIST-BUTTON-BASE-INHERITANCE (disabled from Base Button)
      disabled: { type: 'boolean', empty: 'fallback' },
    });
    // P-BRUTALIST-BUTTON-DEFAULTS
    def.props.setDefaults({
      variant: 'solid',
      color: 'main',
      size: 'default',
      wrap: false,
      disabled: false,
    });

    // P-BRUTALIST-BUTTON-BASE-INHERITANCE
    const inherited = asButton();
    const buttonState = inherited.stateHandles;
    if (!buttonState) {
      throw new Error('[brutalist-button] asButton must project Button state handles.');
    }
    const { disabled, hovered, focusVisible, pressed } = buttonState;

    def.feedback.style.use(tw(BUTTON_BASE_TOKENS));

    // P-BRUTALIST-BUTTON-MOTION: one CSS clock covers both transform and shadow.
    // The bounded preference lease updates already-mounted controls. Unknown is
    // deliberately static; no resident writer competes for these properties.
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('no-preference'),
      intent: (i) => i.feedback.style.use(tw('transition-all')),
    });
    def.rule({
      when: (w) => w.not(w.meta('preference.reducedMotion').eq('no-preference')),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });

    // P-BRUTALIST-BUTTON-COLOR-PROP — solid and noShadow color pairs
    (Object.keys(SOLID_COLOR_TOKENS) as BrutalistButtonColor[]).forEach((color) => {
      def.rule({
        when: (w) => w.all(w.prop('variant').eq('solid'), w.prop('color').eq(color)),
        intent: (i) => i.feedback.style.use(tw(SOLID_COLOR_TOKENS[color])),
      });
      def.rule({
        when: (w) => w.all(w.prop('variant').eq('noShadow'), w.prop('color').eq(color)),
        intent: (i) => i.feedback.style.use(tw(NO_SHADOW_COLOR_TOKENS[color])),
      });
    });

    // P-BRUTALIST-BUTTON-VARIANT-PROP — surface / destructive fills
    (Object.keys(VARIANT_FILL_TOKENS) as Array<keyof typeof VARIANT_FILL_TOKENS>).forEach(
      (variant) => {
        def.rule({
          when: (w) => w.prop('variant').eq(variant),
          intent: (i) => i.feedback.style.use(tw(VARIANT_FILL_TOKENS[variant])),
        });
      }
    );

    // P-BRUTALIST-BUTTON-SIZE-PROP
    (Object.keys(SIZE_TOKENS) as BrutalistButtonSize[]).forEach((size) => {
      def.rule({
        when: (w) =>
          ICON_SIZES.has(size)
            ? w.prop('size').eq(size)
            : w.all(w.prop('size').eq(size), w.prop('wrap').eq(false)),
        intent: (i) => i.feedback.style.use(tw(SIZE_TOKENS[size])),
      });
    });

    // P-BRUTALIST-BUTTON-WRAP: family-owned minimum, not a consumer height override.
    for (const size of ['default', 'xs', 'sm', 'lg'] as const) {
      def.rule({
        when: (w) => w.all(w.prop('size').eq(size), w.prop('wrap').eq(true)),
        intent: (i) => i.feedback.style.use(tw(WRAP_SIZE_TOKENS[size])),
      });
    }

    // P-BRUTALIST-BUTTON-INTERACTION — hover feedback (omitted for noShadow)
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.not(w.prop('variant').eq('noShadow'))),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_HOVER_LIFT_TOKENS} ${BRUTALIST_MOTION_HIT_TOKENS}`)),
    });
    // P-BRUTALIST-BUTTON-INTERACTION — press snap (omitted for noShadow)
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(true), w.not(w.prop('variant').eq('noShadow'))),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_PRESS_TOKENS} ${BRUTALIST_MOTION_HIT_TOKENS}`)),
    });
    // P-BRUTALIST-BUTTON-INTERACTION — focus-visible ring
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    // P-BRUTALIST-BUTTON-INTERACTION — disabled
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });

    // Intentionally no blanket dark `text-foreground` override.
    // P-BRUTALIST-BUTTON-PAIR-INVARIANT, P-BRUTALIST-BUTTON-LIGHT-DARK:
    // accent pairs are theme-invariant; surface/destructive use CSS variables so a
    // host theme change repaints mounted controls without pointer interaction.
    return inherited.render;
  },
});

export type {
  BrutalistButtonColor,
  BrutalistButtonExposes,
  BrutalistButtonProps,
  BrutalistButtonSize,
  BrutalistButtonVariant,
};
export default button;
