import { tw, type DefHandle, type State } from '@proto.ui/core';
import type { ShadcnStyleProps } from '../style-scope';
import { MODERN_OVERLAY_STYLES, setupOverlayStyle } from './style';
import {
  SHADCN_ACTION_BASE,
  SHADCN_ACTION_TEXT,
  SHADCN_ACTION_RADIUS,
  SHADCN_ACTION_FOCUS,
  SHADCN_ACTION_SIZES,
  SHADCN_ACTION_WRAP_SIZES,
  SHADCN_BUTTON_OUTLINE,
  SHADCN_BUTTON_OUTLINE_HOVER,
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

/** Finite passive Button recipes, not asButton or a second command owner.
 * AlertDialog New York keeps 02cad611, modern recipes keep 3d98900e9b73.
 * wrap is the existing Proto long-label adaptation, not an upstream size.
 */
export function setupPassiveOverlayAction<
  Props extends ShadcnStyleProps & { wrap?: boolean },
  Exposes = Record<string, unknown>,
>(
  def: DefHandle<Props, Exposes>,
  state: {
    hovered: State<boolean>;
    focusVisible: State<boolean>;
    disabled: State<boolean>;
    pressed: State<boolean>;
  },
  variant: 'default' | 'outline'
) {
  const cdef = def as unknown as DefHandle<ShadcnStyleProps & { wrap?: boolean }>;
  cdef.props.define({ wrap: { type: 'boolean', empty: 'fallback' } });
  cdef.props.setDefaults({ wrap: false });
  const style = setupOverlayStyle(def);
  cdef.rule({
    when: (w) => w.state(style).eq('new-york-v4'),
    intent: (i) =>
      i.feedback.style.use(
        tw(
          SHADCN_BUTTON_BASE_TOKENS,
          variant === 'default'
            ? SHADCN_BUTTON_DEFAULT_VARIANT_TOKENS
            : SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS
        )
      ),
  });
  cdef.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('wrap').eq(false)),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DEFAULT_SIZE_TOKENS)),
  });
  cdef.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('wrap').eq(true)),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS)),
  });
  cdef.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false)
      ),
    // Correct the local default's old /80 mismatch against the independent /90 source.
    intent: (i) =>
      i.feedback.style.use(
        tw(variant === 'default' ? 'bg-primary/90' : SHADCN_BUTTON_OUTLINE_HOVER_TOKENS)
      ),
  });
  cdef.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(state.focusVisible).eq(true)),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_FOCUS_TOKENS)),
  });
  for (const profile of MODERN_OVERLAY_STYLES) {
    cdef.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            SHADCN_ACTION_BASE,
            SHADCN_ACTION_TEXT[profile],
            SHADCN_ACTION_RADIUS[profile],
            variant === 'default'
              ? 'bg-primary text-primary-foreground'
              : SHADCN_BUTTON_OUTLINE[profile]
          )
        ),
    });
    cdef.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.prop('wrap').eq(false)),
      intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_SIZES[`${profile}-default`])),
    });
    cdef.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.prop('wrap').eq(true)),
      intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_WRAP_SIZES[`${profile}-default`])),
    });
    cdef.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(variant === 'default' ? 'bg-primary/80' : SHADCN_BUTTON_OUTLINE_HOVER[profile])
        ),
    });
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
  if (variant === 'outline') {
    for (const profile of ['vega', 'nova', 'lyra', 'new-york-v4'] as const) {
      cdef.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw('border-input bg-input/30')),
      });
      cdef.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark'),
            w.state(state.hovered).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw('bg-input/50')),
      });
    }
    cdef.rule({
      when: (w) => w.all(w.state(style).eq('mira'), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('bg-input/30')),
    });
    for (const profile of ['maia', 'mira'] as const) {
      cdef.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark'),
            w.state(state.hovered).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw('bg-input/50')),
      });
    }
    for (const profile of ['luma', 'rhea'] as const) {
      cdef.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw('bg-transparent')),
      });
    }
    for (const profile of ['luma', 'sera', 'rhea'] as const) {
      cdef.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.meta('colorScheme').eq('dark'),
            w.state(state.hovered).eq(true),
            w.state(state.disabled).eq(false)
          ),
        intent: (i) => i.feedback.style.use(tw('bg-input/30')),
      });
    }
  }
  cdef.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DISABLED_TOKENS)),
  });
  return style;
}
