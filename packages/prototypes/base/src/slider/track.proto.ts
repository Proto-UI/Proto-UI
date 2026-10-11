import type { SliderPartExposes } from './types';
import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAxisInput } from '@proto.ui/hooks';
import { setupSliderPart } from './part-setup';
import { SLIDER_FAMILY, SLIDER_CONTEXT, sliderMethod } from './shared';
import type { SliderPartProps } from './types';
function setup(def: DefHandle<SliderPartProps>) {
  const render = setupSliderPart(def, 'track');
  let rootAvailable = false;
  let thumbAvailable = false;
  let accepted = false;
  const axis = asAxisInput<SliderPartProps>();
  // Disabling the public input closes its real host gesture/capture lease. The
  // accepted flag additionally guards samples already in delivery; it is not
  // a substitute for terminating that lease.
  const revoke = () => {
    accepted = false;
    axis.sync({ disabled: true });
  };
  const sync = (run: RunHandle<SliderPartProps>) => {
    if (!rootAvailable || !thumbAvailable) {
      revoke();
      return;
    }
    const c = run.context.read(SLIDER_CONTEXT);
    // Reset or a Root-owned cancellation can end the logical session while
    // the Track is still mounted. Close it before rearming fresh input.
    if (accepted && c.interactionPhase !== 'active') revoke();
    axis.sync({
      axis: c.orientation,
      direction: c.direction,
      reverse: c.orientation === 'vertical',
      disabled: c.disabled,
      readOnly: c.readOnly,
    });
  };
  // Observe required-part leases before AxisInput observes the same topology.
  // A retired Root cannot be queried by a cancellation delivered during cleanup.
  def.anatomy.subscribeParts(SLIDER_FAMILY, 'root', (run, parts) => {
    rootAvailable = parts.length === 1;
    sync(run);
  });
  def.anatomy.subscribeParts(SLIDER_FAMILY, 'thumb', (run, parts) => {
    thumbAvailable = parts.length === 1;
    sync(run);
  });
  axis.configure({ anatomy: SLIDER_FAMILY, inputRole: 'track', geometryRole: 'track' });
  def.context.subscribe(SLIDER_CONTEXT, sync);
  def.lifecycle.onMounted((run) => {
    rootAvailable = run.anatomy.partsOf(SLIDER_FAMILY, 'root').length === 1;
    thumbAvailable = run.anatomy.partsOf(SLIDER_FAMILY, 'thumb').length === 1;
    sync(run);
  });
  def.lifecycle.onUnmounted(() => {
    rootAvailable = false;
    thumbAvailable = false;
    accepted = false;
  });
  axis.on((run, sample) => {
    if (sample.phase === 'cancel') {
      accepted = false;
      if (!rootAvailable) return;
      sliderMethod(run, 'cancelInteraction');
      return;
    }
    if (sample.phase === 'start') {
      accepted = rootAvailable && thumbAvailable;
      if (!accepted || !sliderMethod(run, 'beginInteraction')) {
        revoke();
        sync(run);
        return;
      }
      const focus = run.anatomy.partsOf(SLIDER_FAMILY, 'thumb')[0]?.getExpose('focusSelf');
      if (typeof focus === 'function') focus();
    }
    const c = run.context.read(SLIDER_CONTEXT);
    if (!accepted || !rootAvailable || !thumbAvailable || c.interactionPhase !== 'active') {
      revoke();
      sync(run);
      return;
    }
    if (sample.phase === 'end') accepted = false;
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
