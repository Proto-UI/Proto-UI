import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { SLIDER_FAMILY } from './shared';
import type { SliderRootAsHookContract, SliderRootExposes, SliderRootProps } from './types';

function setupSliderRoot(def: DefHandle<SliderRootProps, SliderRootExposes>): void {
  def.anatomy.claim(SLIDER_FAMILY, { role: 'root' });

  def.props.define({
    value: { type: 'number', empty: 'fallback' },
    defaultValue: { type: 'number', empty: 'fallback' },
    min: { type: 'number', empty: 'fallback' },
    max: { type: 'number', empty: 'fallback' },
    step: { type: 'number', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    orientation: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultValue: 0,
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    orientation: 'horizontal',
  });

  def.expose.event('valueChange', { payload: 'json' });

  const value = def.state.number('value', 0);
  const disabled = def.state.bool('disabled', false);
  def.expose.state('value', value);
  def.expose.state('disabled', disabled);

  let controlled = false;

  const clampValue = (v: number, min: number, max: number, step: number): number => {
    const stepped = Math.round(v / step) * step;
    return Math.max(min, Math.min(max, stepped));
  };

  def.lifecycle.onCreated((run) => {
    controlled = run.props.isProvided('value');
    disabled.set(!!run.props.get().disabled, 'reason: lifecycle.onCreated => disabled');
    const initialValue = controlled
      ? (run.props.get().value ?? 0)
      : (run.props.get().defaultValue ?? 0);
    const min = run.props.get().min ?? 0;
    const max = run.props.get().max ?? 100;
    const step = run.props.get().step ?? 1;
    value.set(
      clampValue(initialValue, min, max, step),
      'reason: lifecycle.onCreated => initialize value'
    );
  });

  def.props.watch(['value'], (run, next) => {
    controlled = run.props.isProvided('value');
    if (controlled) {
      const min = run.props.get().min ?? 0;
      const max = run.props.get().max ?? 100;
      const step = run.props.get().step ?? 1;
      value.set(
        clampValue(next.value ?? 0, min, max, step),
        'reason: props.watch(value) => controlled sync'
      );
    }
  });

  def.props.watch(['disabled'], (_run, next) => {
    disabled.set(!!next.disabled, 'reason: props.watch(disabled)');
  });

  def.event.on('slide.commit', (run) => {
    if (disabled.get()) return;
    const nextValue = run.event.payload?.value as number | undefined;
    if (nextValue === undefined) return;
    const min = run.props.get().min ?? 0;
    const max = run.props.get().max ?? 100;
    const step = run.props.get().step ?? 1;
    const clamped = clampValue(nextValue, min, max, step);
    if (!controlled) {
      value.set(clamped, 'reason: event.on(slide.commit) => update value');
    }
    run.event.emit('valueChange', { value: clamped });
  });
}

export const asSliderRoot = defineAsHook<
  SliderRootProps,
  SliderRootExposes,
  SliderRootAsHookContract
>({
  name: 'as-slider-root',
  mode: 'once',
  setup: setupSliderRoot,
});

const sliderRoot = definePrototype({
  name: 'base-slider-root',
  setup: setupSliderRoot,
});

export default sliderRoot;
