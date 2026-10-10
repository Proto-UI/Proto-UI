import type { SliderPartExposes } from './types';
import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAxisInput } from '@proto.ui/hooks';
import { setupSliderPart } from './part-setup';
import { SLIDER_FAMILY, SLIDER_CONTEXT, sliderMethod } from './shared';
import type { SliderPartProps } from './types';
function setup(def: DefHandle<SliderPartProps>) {
  const render = setupSliderPart(def, 'track');
  const axis = asAxisInput<SliderPartProps>();
  axis.configure({ anatomy: SLIDER_FAMILY, inputRole: 'track', geometryRole: 'track' });
  const sync = (run: RunHandle<SliderPartProps>) => {
    const c = run.context.read(SLIDER_CONTEXT);
    axis.sync({
      axis: c.orientation,
      direction: c.direction,
      reverse: c.orientation === 'vertical',
      disabled: c.disabled,
      readOnly: c.readOnly,
    });
  };
  def.context.subscribe(SLIDER_CONTEXT, sync);
  def.lifecycle.onMounted(sync);
  axis.on((run, sample) => {
    if (sample.phase === 'cancel') {
      sliderMethod(run, 'cancelInteraction');
      return;
    }
    const c = run.context.read(SLIDER_CONTEXT);
    if (sample.phase === 'start') {
      if (!sliderMethod(run, 'beginInteraction')) return;
      const focus = run.anatomy.partsOf(SLIDER_FAMILY, 'thumb')[0]?.getExpose('focusSelf');
      if (typeof focus === 'function') focus();
    }
    const span = c.max - c.min;
    // Normalized endpoints are finite and ordered; AxisInput positions are in [0, 1].
    // An overflowing span therefore has opposite-sign endpoints, so this convex
    // combination keeps each product finite and cannot overflow their sum.
    const next = Number.isFinite(span)
      ? c.min + sample.position * span
      : c.min * (1 - sample.position) + c.max * sample.position;
    sliderMethod(run, 'requestValue', next);
    if (sample.phase === 'end') sliderMethod(run, 'commitValue');
  });
  return render;
}
export const asSliderTrack = defineAsHook<
  SliderPartProps,
  SliderPartExposes,
  {
    state: {
      value: State<number>;
      percentage: State<number>;
      disabled: State<boolean>;
      readOnly: State<boolean>;
      orientation: State<string>;
      direction: State<string>;
    };
  }
>({ name: 'as-slider-track', setup });
export default definePrototype<SliderPartProps, SliderPartExposes>({
  name: 'base-slider-track',
  setup,
});
