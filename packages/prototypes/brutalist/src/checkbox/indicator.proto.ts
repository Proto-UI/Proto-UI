import { definePrototype, delay, type RendererHandle, tw } from '@proto.ui/core';
import { asCheckboxIndicator } from '@proto.ui/prototypes-base/checkbox';
import type { BrutalistCheckboxIndicatorExposes, BrutalistCheckboxIndicatorProps } from './types';

const INDICATOR_SURFACE_TOKENS =
  'inline-flex size-3.5 items-center justify-center text-current transition-none';

function glyphPath(checked: boolean, indeterminate: boolean): string | null {
  if (indeterminate) return 'M5 12h14';
  if (checked) return 'm20 6-11 11-5-5';
  return null;
}

function renderGlyph(renderer: Pick<RendererHandle<any>, 'svg'>, path: string | null) {
  if (!path) return null;
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
    renderer.svg.path({ d: path })
  );
}

const checkboxIndicator = definePrototype<
  BrutalistCheckboxIndicatorProps,
  BrutalistCheckboxIndicatorExposes
>({
  name: 'brutalist-checkbox-indicator',
  setup(def) {
    const state = asCheckboxIndicator().stateHandles;
    if (!state) {
      throw new Error(
        '[brutalist-checkbox-indicator] asCheckboxIndicator must project Checkbox indicator state handles.'
      );
    }
    const { checked, indeterminate } = state;

    def.feedback.style.use(tw(INDICATOR_SURFACE_TOKENS));
    def.rule({
      when: (when) => when.state(checked).eq(true),
      intent: (intent) => intent.feedback.style.use(tw('opacity-100')),
    });
    def.rule({
      when: (when) => when.state(indeterminate).eq(true),
      intent: (intent) => intent.feedback.style.use(tw('opacity-100')),
    });
    def.rule({
      when: (when) => when.all(when.state(checked).eq(false), when.state(indeterminate).eq(false)),
      intent: (intent) => intent.feedback.style.use(tw('opacity-0')),
    });

    let pendingRender: { cancel(): void } | null = null;
    const requestRender = (run: { update(): void }, event: { type: string }) => {
      if (event.type !== 'next') return;
      pendingRender?.cancel();
      pendingRender = delay(0, () => {
        pendingRender = null;
        run.update();
      });
    };
    checked.watch(requestRender);
    indeterminate.watch(requestRender);
    def.lifecycle.onUnmounted(() => {
      pendingRender?.cancel();
      pendingRender = null;
    });

    return (renderer) => [
      renderer.r.slot(),
      renderGlyph(renderer, glyphPath(checked.get(), indeterminate.get())),
    ];
  },
});

export default checkboxIndicator;
