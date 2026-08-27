import { definePrototype, delay, type RendererHandle, tw } from '@proto.ui/core';
import { asCheckboxIndicator } from '@proto.ui/prototypes-base/checkbox';
import type { BrutalistCheckboxIndicatorExposes, BrutalistCheckboxIndicatorProps } from './types';

const INDICATOR_BASE_TOKENS = 'inline-flex size-3.5 items-center justify-center text-current';

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
      'aria-hidden': 'true',
      width: '100%',
      height: '100%',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 3,
      strokeLinecap: 'square',
      strokeLinejoin: 'miter',
    },
    renderer.svg.path({ d })
  );
}

const checkboxIndicator = definePrototype<
  BrutalistCheckboxIndicatorProps,
  BrutalistCheckboxIndicatorExposes
>({
  name: 'brutalist-checkbox-indicator',
  setup(def) {
    const indicator = asCheckboxIndicator();
    const state = indicator.stateHandles;
    if (!state) {
      throw new Error(
        '[brutalist-checkbox-indicator] asCheckboxIndicator must project Indicator state handles.'
      );
    }
    const { checked, indeterminate } = state;

    def.feedback.style.use(tw(INDICATOR_BASE_TOKENS));

    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-100')),
    });
    def.rule({
      when: (w) => w.state(indeterminate).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-100')),
    });
    def.rule({
      when: (w) => w.all(w.state(checked).eq(false), w.state(indeterminate).eq(false)),
      intent: (i) => i.feedback.style.use(tw('opacity-0')),
    });

    let renderTask: { cancel(): void } | null = null;
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

export default checkboxIndicator;
