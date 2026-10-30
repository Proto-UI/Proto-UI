import {
  tw,
  type BorrowedStateHandle,
  type ObservedStateHandle,
  type OwnedStateHandle,
  type DefHandle,
} from '@proto.ui/core';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { SHADCN_STYLE_IDS, type ShadcnStyleId } from '../style-scope';
import {
  SCALAR_THUMB_PAINT,
  SCALAR_LUMA_VERTICAL_PAINT,
  type ShadcnSliderPartProps,
} from './scalar-visual';

// The styled decoration is passive and has no input, role, focus or event
// owner. Rule observes source facts and the owned style selection directly;
// it needs no watch on an owned State or manual lifecycle unsubscription.
export function sliderThumbPaint<Exposes>(
  def: DefHandle<ShadcnSliderPartProps, Exposes>,
  state: {
    disabled: BorrowedStateHandle<boolean, SliderPartProps>;
    hovered: BorrowedStateHandle<boolean, SliderPartProps>;
    pressed: BorrowedStateHandle<boolean, SliderPartProps>;
    focusVisible: ObservedStateHandle<boolean, SliderPartProps>;
    orientation: BorrowedStateHandle<string, SliderPartProps>;
  },
  style: OwnedStateHandle<ShadcnStyleId>
) {
  const paint = def.feedback.style.declareDecoration();
  for (const profile of SHADCN_STYLE_IDS) {
    const pressedPaint = profile === 'nova' || profile === 'lyra' || profile === 'mira';
    for (const axis of ['horizontal', 'vertical'] as const) {
      const recipe =
        profile === 'luma' && axis === 'vertical'
          ? SCALAR_LUMA_VERTICAL_PAINT
          : SCALAR_THUMB_PAINT[profile];
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(state.orientation).eq(axis),
            w.any(
              w.state(state.disabled).eq(true),
              w.all(
                w.state(state.focusVisible).eq(false),
                w.state(state.hovered).eq(false),
                pressedPaint ? w.state(state.pressed).eq(false) : w.t()
              )
            )
          ),
        intent: (i) => i.feedback.style.to(paint).use(recipe.rest),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(state.orientation).eq(axis),
            w.state(state.disabled).eq(false),
            w.state(state.focusVisible).eq(false),
            pressedPaint
              ? w.any(w.state(state.hovered).eq(true), w.state(state.pressed).eq(true))
              : w.state(state.hovered).eq(true)
          ),
        intent: (i) => i.feedback.style.to(paint).use(recipe.hover),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(state.orientation).eq(axis),
            w.state(state.disabled).eq(false),
            w.state(state.focusVisible).eq(true)
          ),
        intent: (i) => i.feedback.style.to(paint).use(recipe.focus),
      });
    }
    if (profile === 'luma' || profile === 'rhea') {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.not(w.meta('colorScheme').eq('dark'))),
        intent: (i) => i.feedback.style.to(paint).use(tw('bg-clip-padding')),
      });
    }
  }
  return paint;
}
