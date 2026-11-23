import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAxisInput } from '@proto.ui/hooks';
import { setupSliderValuesPart } from './values-part-setup';
import {
  SLIDER_VALUES_CONTEXT,
  SLIDER_VALUES_FAMILY,
  sliderValuesMethod,
  type SliderValuesContext,
} from './values-shared';
import { percentage } from '../progress/range';
import { sliderValuesPointer } from './values-numeric';
import type {
  SliderValuesPartProps,
  SliderValuesPartExposes,
  SliderValuesPartStates,
} from './values-types';
function setup(def: DefHandle<SliderValuesPartProps>) {
  const render = setupSliderValuesPart(def, 'track');
  const axis = asAxisInput<SliderValuesPartProps>();
  let mounted = false;
  let rootAvailable = false,
    accepted = false,
    fromThumb = false;
  let startFraction = 0,
    focusedIndex = -1;
  const revoke = () => {
    accepted = false;
    if (mounted) axis.sync({ disabled: true });
  };
  const sync = (run: RunHandle<SliderValuesPartProps>) => {
    if (!mounted) return;
    if (!rootAvailable) {
      revoke();
      return;
    }
    const c = run.context.read(SLIDER_VALUES_CONTEXT),
      p = run.props.get();
    if (accepted && !c.interacting) revoke();
    axis.sync({
      axis: c.orientation,
      direction: c.direction,
      reverse: c.orientation === 'vertical',
      disabled: !!p.disabled || c.disabled || !c.ready || !c.mappingReady || c.values.length === 0,
      readOnly: !!p.readOnly || c.readOnly,
    });
  };
  def.anatomy.subscribeParts(SLIDER_VALUES_FAMILY, 'root', (run, parts) => {
    rootAvailable = parts.length === 1;
    sync(run);
  });
  axis.configure({
    anatomy: SLIDER_VALUES_FAMILY,
    inputRole: 'track',
    geometryRole: 'track',
    originRole: 'thumb',
  });
  def.context.subscribe(SLIDER_VALUES_CONTEXT, sync);
  def.props.watchAll(sync);
  def.lifecycle.onMounted((run) => {
    mounted = true;
    rootAvailable = run.anatomy.partsOf(SLIDER_VALUES_FAMILY, 'root').length === 1;
    sync(run);
  });
  const retire = () => {
    mounted = false;
    rootAvailable = false;
    accepted = false;
  };
  def.lifecycle.onUnmounted(retire);
  def.lifecycle.onBeforeDispose(retire);
  const valueAt = (fraction: number, c: SliderValuesContext) => {
    const f = Math.min(1, Math.max(0, fraction)),
      span = c.max - c.min;
    return Number.isFinite(span) ? c.min + f * span : c.min * (1 - f) + c.max * f;
  };
  const focusSlot = (run: RunHandle<SliderValuesPartProps>, index: number) => {
    if (index < 0 || index === focusedIndex) return;
    for (const part of run.anatomy.order.partsOf(SLIDER_VALUES_FAMILY, 'thumb')) {
      const info = part.getExpose('getSlotInfo');
      if (typeof info !== 'function' || info().index !== index) continue;
      const focus = part.getExpose('focusSelf');
      if (typeof focus === 'function') {
        focusedIndex = index;
        focus();
      }
      return;
    }
  };
  axis.on((run, sample) => {
    if (!mounted) return;
    if (sample.phase === 'cancel') {
      const wasAccepted = accepted;
      accepted = false;
      if (wasAccepted && rootAvailable) sliderValuesMethod(run, 'cancelInteraction');
      return;
    }
    if (!rootAvailable) {
      revoke();
      return;
    }
    let c = run.context.read(SLIDER_VALUES_CONTEXT);
    if (sample.phase === 'start') {
      const parts = run.anatomy.order.partsOf(SLIDER_VALUES_FAMILY, 'thumb');
      let index = -1;
      fromThumb = sample.originIndex !== null;
      if (fromThumb) {
        const part = typeof sample.originIndex === 'number' ? parts[sample.originIndex] : null;
        const getInfo = part?.getExpose('getSlotInfo');
        const info = typeof getInfo === 'function' ? getInfo() : null;
        if (info && !info.disabled && !info.readOnly) index = info.index;
      } else {
        let distance = Infinity;
        for (const part of parts) {
          const getInfo = part.getExpose('getSlotInfo');
          const info = typeof getInfo === 'function' ? getInfo() : null;
          if (
            !info ||
            info.disabled ||
            info.readOnly ||
            !Number.isInteger(info.index) ||
            info.index < 0 ||
            info.index >= c.values.length
          )
            continue;
          const nextDistance = Math.abs(
            sample.position - percentage(c.values[info.index], c.min, c.max) / 100
          );
          if (nextDistance < distance || (nextDistance === distance && info.index < index)) {
            distance = nextDistance;
            index = info.index;
          }
        }
      }
      accepted = index >= 0 && index < c.values.length;
      startFraction = accepted ? percentage(c.values[index], c.min, c.max) / 100 : 0;
      focusedIndex = -1;
      if (!accepted || !sliderValuesMethod(run, 'beginInteraction', index)) {
        revoke();
        sync(run);
        return;
      }
      focusSlot(run, index);
      if (!mounted || !accepted || !rootAvailable) return;
      c = run.context.read(SLIDER_VALUES_CONTEXT);
      if (fromThumb) return;
    }
    if (!accepted || !c.interacting) {
      revoke();
      sync(run);
      return;
    }
    if (sample.phase === 'end') accepted = false;
    const next = sliderValuesPointer(
      valueAt(fromThumb ? startFraction + sample.totalDelta : sample.position, c),
      c
    );
    if (next === null) {
      sliderValuesMethod(run, 'cancelInteraction');
      revoke();
      sync(run);
      return;
    }
    sliderValuesMethod(run, 'requestInteractionValue', next);
    if (!mounted || !rootAvailable) return;
    c = run.context.read(SLIDER_VALUES_CONTEXT);
    if (c.interacting) focusSlot(run, c.activeIndex);
    if (mounted && rootAvailable && sample.phase === 'end') sliderValuesMethod(run, 'commitValue');
  });
  return render;
}
export const asSliderValuesTrack = defineAsHook<
  SliderValuesPartProps,
  SliderValuesPartExposes,
  { state: SliderValuesPartStates }
>({ name: 'as-slider-values-track', setup });
export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'base-slider-values-track',
  setup,
});
