import { tw, type DefHandle, type State } from '@proto.ui/core';
import type { ShadcnStyleProps } from '../style-scope';
import { MODERN_OVERLAY_STYLES, setupOverlayStyle } from '../dialog/style';
import {
  SHADCN_ACTION_BASE,
  SHADCN_ACTION_TEXT,
  SHADCN_ACTION_RADIUS,
  SHADCN_ACTION_FOCUS,
  SHADCN_ACTION_SIZES,
  SHADCN_ACTION_WRAP_SIZES,
  SHADCN_BUTTON_OUTLINE,
  SHADCN_BUTTON_OUTLINE_HOVER,
  SHADCN_SECONDARY_HOVER,
} from '../button/profiles';
import {
  SHADCN_BUTTON_BASE_TOKENS,
  SHADCN_BUTTON_DEFAULT_SIZE_TOKENS,
  SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS,
  SHADCN_BUTTON_DEFAULT_VARIANT_TOKENS,
  SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS,
  SHADCN_BUTTON_OUTLINE_HOVER_TOKENS,
  SHADCN_BUTTON_FOCUS_TOKENS,
  SHADCN_BUTTON_DISABLED_TOKENS,
} from '../button/paint';
import type { ShadcnAlertDialogActionSize, ShadcnAlertDialogActionVariant } from './types';

type PassiveActionProps = ShadcnStyleProps & {
  variant?: ShadcnAlertDialogActionVariant;
  size?: ShadcnAlertDialogActionSize;
  wrap?: boolean;
};

const MODERN_VARIANTS: Record<Exclude<ShadcnAlertDialogActionVariant, 'outline'>, string> = {
  default: 'bg-primary text-primary-foreground',
  destructive: 'border-transparent bg-destructive/10 text-destructive',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  ghost: 'border-transparent bg-transparent text-foreground',
  link: 'border-transparent bg-transparent text-primary underline-offset-4',
};

const MODERN_HOVER: Record<Exclude<ShadcnAlertDialogActionVariant, 'outline'>, string> = {
  default: 'bg-primary/80',
  destructive: 'bg-destructive/20',
  secondary: SHADCN_SECONDARY_HOVER,
  ghost: 'bg-muted text-foreground',
  link: 'underline',
};

const NEW_YORK_VARIANTS: Record<ShadcnAlertDialogActionVariant, string> = {
  default: SHADCN_BUTTON_DEFAULT_VARIANT_TOKENS,
  destructive: 'bg-destructive text-white shadow-xs',
  outline: SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS,
  secondary: 'bg-secondary text-secondary-foreground shadow-xs',
  ghost: 'bg-transparent text-foreground',
  link: 'bg-transparent text-primary underline-offset-4',
};

const NEW_YORK_HOVER: Record<ShadcnAlertDialogActionVariant, string> = {
  default: 'bg-primary/90',
  destructive: 'bg-destructive/90',
  outline: SHADCN_BUTTON_OUTLINE_HOVER_TOKENS,
  secondary: 'bg-secondary/80',
  ghost: 'bg-accent text-accent-foreground',
  link: 'underline',
};

const NEW_YORK_SIZES: Record<ShadcnAlertDialogActionSize, string> = {
  default: SHADCN_BUTTON_DEFAULT_SIZE_TOKENS,
  sm: 'h-8 rounded-md gap-1.5 px-3 whitespace-nowrap',
  lg: 'h-10 rounded-md px-6 whitespace-nowrap',
  icon: 'size-9 whitespace-nowrap',
};

const NEW_YORK_WRAP_SIZES: Record<Exclude<ShadcnAlertDialogActionSize, 'icon'>, string> = {
  default: SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS,
  sm: 'min-h-8 h-auto gap-1.5 px-3 py-1 whitespace-normal min-w-0 max-w-full wrap-anywhere text-center',
  lg: 'min-h-10 h-auto gap-2 px-6 py-1 whitespace-normal min-w-0 max-w-full wrap-anywhere text-center',
};

/** Finite passive Button paint for AlertDialog Trigger, Action, and Cancel.
 * AlertDialog commands retain their single Base interaction owner.
 */
export function setupAlertDialogButtonPaint<
  Props extends PassiveActionProps,
  Exposes = Record<string, unknown>,
>(
  def: DefHandle<Props, Exposes>,
  state: {
    hovered: State<boolean>;
    focusVisible: State<boolean>;
    disabled: State<boolean>;
    pressed: State<boolean>;
  },
  defaultVariant: ShadcnAlertDialogActionVariant
) {
  const cdef = def as unknown as DefHandle<PassiveActionProps>;
  cdef.props.define({
    variant: {
      type: 'enum',
      empty: 'fallback',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      type: 'enum',
      empty: 'fallback',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    wrap: { type: 'boolean', empty: 'fallback' },
  });
  cdef.props.setDefaults({ variant: defaultVariant, size: 'default', wrap: false });
  const style = setupOverlayStyle(def);

  // New York compatibility recipe.
  cdef.rule({
    when: (w) => w.state(style).eq('new-york-v4'),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_BASE_TOKENS)),
  });
  for (const variant of Object.keys(NEW_YORK_VARIANTS) as ShadcnAlertDialogActionVariant[]) {
    cdef.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('variant').eq(variant)),
      intent: (i) => i.feedback.style.use(tw(NEW_YORK_VARIANTS[variant])),
    });
    cdef.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.prop('variant').eq(variant),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(NEW_YORK_HOVER[variant])),
    });
  }
  for (const size of ['default', 'sm', 'lg', 'icon'] as const) {
    if (size === 'icon') {
      cdef.rule({
        when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('size').eq(size)),
        intent: (i) => i.feedback.style.use(tw(NEW_YORK_SIZES[size])),
      });
    } else {
      cdef.rule({
        when: (w) =>
          w.all(
            w.state(style).eq('new-york-v4'),
            w.prop('size').eq(size),
            w.prop('wrap').eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw(NEW_YORK_SIZES[size])),
      });
      cdef.rule({
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
  cdef.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(state.focusVisible).eq(true)),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_FOCUS_TOKENS)),
  });
  cdef.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.state(state.focusVisible).eq(true),
        w.prop('variant').eq('destructive')
      ),
    intent: (i) => i.feedback.style.use(tw('ring-destructive/20')),
  });
  cdef.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.meta('colorScheme').eq('dark'),
        w.prop('variant').eq('destructive')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-destructive/60')),
  });
  cdef.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.meta('colorScheme').eq('dark'),
        w.state(state.focusVisible).eq(true),
        w.prop('variant').eq('destructive')
      ),
    intent: (i) => i.feedback.style.use(tw('ring-destructive/40')),
  });
  cdef.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.meta('colorScheme').eq('dark'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false),
        w.prop('variant').eq('ghost')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-accent/50')),
  });

  // Eight modern style profiles (vega, nova, maia, lyra, mira, luma, sera, rhea).
  for (const profile of MODERN_OVERLAY_STYLES) {
    cdef.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) =>
        i.feedback.style.use(
          tw(SHADCN_ACTION_BASE, SHADCN_ACTION_TEXT[profile], SHADCN_ACTION_RADIUS[profile])
        ),
    });
    cdef.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.prop('variant').eq('outline')),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_OUTLINE[profile])),
    });
    cdef.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.prop('variant').eq('outline'),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_OUTLINE_HOVER[profile])),
    });
    for (const size of ['default', 'sm', 'lg', 'icon'] as const) {
      if (size === 'icon') {
        cdef.rule({
          when: (w) => w.all(w.state(style).eq(profile), w.prop('size').eq(size)),
          intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_SIZES[`${profile}-${size}`])),
        });
      } else {
        cdef.rule({
          when: (w) =>
            w.all(w.state(style).eq(profile), w.prop('size').eq(size), w.prop('wrap').eq(false)),
          intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_SIZES[`${profile}-${size}`])),
        });
        cdef.rule({
          when: (w) =>
            w.all(w.state(style).eq(profile), w.prop('size').eq(size), w.prop('wrap').eq(true)),
          intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_WRAP_SIZES[`${profile}-${size}`])),
        });
      }
    }
    cdef.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_FOCUS[profile])),
    });
    cdef.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.pressed).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('translate-y-px')),
    });
  }

  for (const variant of Object.keys(MODERN_VARIANTS) as Array<
    Exclude<ShadcnAlertDialogActionVariant, 'outline'>
  >) {
    cdef.rule({
      when: (w) => w.all(w.not(w.state(style).eq('new-york-v4')), w.prop('variant').eq(variant)),
      intent: (i) => i.feedback.style.use(tw(MODERN_VARIANTS[variant])),
    });
    cdef.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.prop('variant').eq(variant),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(MODERN_HOVER[variant])),
    });
  }
  cdef.rule({
    when: (w) => w.all(w.state(style).eq('sera'), w.prop('variant').eq('link')),
    intent: (i) => i.feedback.style.use(tw('underline')),
  });
  cdef.rule({
    when: (w) =>
      w.all(
        w.not(w.state(style).eq('new-york-v4')),
        w.state(state.focusVisible).eq(true),
        w.prop('variant').eq('destructive')
      ),
    intent: (i) => i.feedback.style.use(tw('border-destructive/40 ring-destructive/20')),
  });
  cdef.rule({
    when: (w) =>
      w.all(
        w.not(w.state(style).eq('new-york-v4')),
        w.meta('colorScheme').eq('dark'),
        w.prop('variant').eq('destructive')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
  });
  cdef.rule({
    when: (w) =>
      w.all(
        w.not(w.state(style).eq('new-york-v4')),
        w.meta('colorScheme').eq('dark'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false),
        w.prop('variant').eq('destructive')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-destructive/30')),
  });
  cdef.rule({
    when: (w) =>
      w.all(
        w.not(w.state(style).eq('new-york-v4')),
        w.meta('colorScheme').eq('dark'),
        w.state(state.focusVisible).eq(true),
        w.prop('variant').eq('destructive')
      ),
    intent: (i) => i.feedback.style.use(tw('ring-destructive/40')),
  });
  cdef.rule({
    when: (w) =>
      w.all(
        w.not(w.state(style).eq('new-york-v4')),
        w.meta('colorScheme').eq('dark'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false),
        w.prop('variant').eq('ghost')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-muted/50')),
  });

  // Dark outline rules matching Button and passive overlay actions.
  for (const profile of ['vega', 'nova', 'lyra', 'new-york-v4'] as const) {
    cdef.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.meta('colorScheme').eq('dark'),
          w.prop('variant').eq('outline')
        ),
      intent: (i) => i.feedback.style.use(tw('border-input bg-input/30')),
    });
    cdef.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.meta('colorScheme').eq('dark'),
          w.prop('variant').eq('outline'),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
  }
  cdef.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('mira'),
        w.meta('colorScheme').eq('dark'),
        w.prop('variant').eq('outline')
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/30')),
  });
  for (const profile of ['maia', 'mira'] as const) {
    cdef.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.meta('colorScheme').eq('dark'),
          w.prop('variant').eq('outline'),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
  }
  for (const profile of ['luma', 'rhea'] as const) {
    cdef.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.meta('colorScheme').eq('dark'),
          w.prop('variant').eq('outline')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-transparent')),
    });
  }
  for (const profile of ['luma', 'sera', 'rhea'] as const) {
    cdef.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.meta('colorScheme').eq('dark'),
          w.prop('variant').eq('outline'),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
  }

  cdef.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DISABLED_TOKENS)),
  });

  return style;
}
