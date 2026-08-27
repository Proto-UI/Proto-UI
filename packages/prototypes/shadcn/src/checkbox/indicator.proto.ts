import { definePrototype, delay, type RendererHandle, tw } from '@proto.ui/core';
import { asCheckboxIndicator } from '@proto.ui/prototypes-base/checkbox';
import type { ShadcnCheckboxIndicatorExposes, ShadcnCheckboxIndicatorProps } from './types';

const INDICATOR_TOKENS = [
  'flex',
  'size-3.5',
  'items-center',
  'justify-center',
  'transition-none',
].join(' ');

/** Mixed reads before checked, so a checkbox that is both never paints a tick. */
function glyphPath(checked: boolean, indeterminate: boolean): string | null {
  if (indeterminate) return 'M5 12h14';
  if (checked) return 'm20 6-11 11-5-5';
  return null;
}

function renderGlyph(renderer: Pick<RendererHandle<any>, 'svg'>, d: string | null) {
  if (!d) return null;
  return renderer.svg.root(
    {
      viewBox: '0 0 24 24',
      // The Root already carries the checkbox role and its checked state, so the
      // glyph would only add an unnamed node to the accessibility tree.
      'aria-hidden': 'true',
      width: '100%',
      height: '100%',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    renderer.svg.path({ d })
  );
}

const checkboxIndicator = definePrototype<
  ShadcnCheckboxIndicatorProps,
  ShadcnCheckboxIndicatorExposes
>({
  name: 'shadcn-checkbox-indicator',
  setup(def) {
    // P-SHADCN-CHECKBOX-INDICATOR-BASE-INHERITANCE,
    // P-SHADCN-CHECKBOX-INDICATOR-CURRENT-BASE-DEVIATIONS,
    // P-SHADCN-CHECKBOX-INDICATOR-CONTEXT-DERIVED
    const indicatorState = asCheckboxIndicator().stateHandles;
    if (!indicatorState) {
      throw new Error(
        '[shadcn-checkbox-indicator] asCheckboxIndicator must project Checkbox indicator state handles.'
      );
    }
    const { checked, indeterminate } = indicatorState;
    // P-SHADCN-CHECKBOX-INDICATOR-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(tw(INDICATOR_TOKENS));

    let renderTask: { cancel(): void } | null = null;
    // P-SHADCN-CHECKBOX-INDICATOR-GLYPH-SELECTION
    const requestGlyphUpdate = (run: any, event: { type: string }) => {
      if (event.type !== 'next') return;
      renderTask?.cancel();
      renderTask = delay(0, () => {
        renderTask = null;
        run.update();
      });
    };
    checked.watch(requestGlyphUpdate);
    indeterminate.watch(requestGlyphUpdate);
    def.lifecycle.onUnmounted(() => {
      renderTask?.cancel();
      renderTask = null;
    });

    return (renderer) => [
      renderer.r.slot(),
      renderGlyph(renderer, glyphPath(checked.get(), indeterminate.get())),
    ];
  },
});

/**
 * P-SHADCN-CHECKBOX-INDICATOR-DIRECT-ENTRY exposes the current anatomy part.
 * P-SHADCN-CHECKBOX-INDICATOR-COMPATIBILITY-SUBSET keeps the upstream composition
 * and token differences outside the passing claim.
 */

export default checkboxIndicator;
