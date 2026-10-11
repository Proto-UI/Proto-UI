import { FIELD_CONTEXT } from '../field/shared';
import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
  type RendererHandle,
} from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { SLIDER_FAMILY, SLIDER_CONTEXT } from './shared';
import { finite, range, quantize, percentage } from '../progress/range';
import type { SliderRootProps, SliderRootExposes, SliderRootAsHookContract } from './types';
function setup(def: DefHandle<SliderRootProps, SliderRootExposes>) {
  def.anatomy.claim(SLIDER_FAMILY, { role: 'root' });
  def.props.define({
    value: { type: 'number', empty: 'fallback' },
    defaultValue: { type: 'number', empty: 'fallback' },
    min: { type: 'number', empty: 'fallback' },
    max: { type: 'number', empty: 'fallback' },
    step: { type: 'number', empty: 'fallback', validator: (v) => Number.isFinite(v) && v > 0 },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    orientation: { type: 'enum', empty: 'fallback', options: ['horizontal', 'vertical'] },
    direction: { type: 'enum', empty: 'fallback', options: ['ltr', 'rtl'] },
    ariaLabel: { type: 'string', empty: 'fallback' },
    valueText: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultValue: 0,
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    readOnly: false,
    orientation: 'horizontal',
    direction: 'ltr',
    ariaLabel: '',
    valueText: '',
  });
  const value = def.state.numberDiscrete('value', 0),
    percentageState = def.state.numberRange('percentage', 0, { min: 0, max: 100 }),
    disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false),
    dragging = def.state.bool('dragging', false),
    orientation = def.state.string('orientation', 'horizontal');
  def.expose.state('value', value);
  def.expose.state('percentage', percentageState);
  def.expose.state('disabled', disabled);
  def.expose.state('readOnly', readOnly);
  def.expose.state('dragging', dragging);
  def.expose.state('orientation', orientation);
  const a = asAccessible();
  a.role('group');
  def.context.provide(SLIDER_CONTEXT, {
    value: 0,
    interactionPhase: 'idle',
    min: 0,
    max: 100,
    step: 1,
    percentage: 0,
    disabled: false,
    readOnly: false,
    controlDisabled: false,
    controlReadOnly: false,
    orientation: 'horizontal',
    direction: 'ltr',
    valueText: '',
    label: '',
  });
  let run: RunHandle<SliderRootProps> | null = null,
    initial = 0;
  let interactionPhase: 'idle' | 'active' | 'commit' | 'cancel' = 'idle';
  const bounds = () => range(run?.props.get().min, run?.props.get().max);
  const normalize = (v: number) => {
    const b = bounds();
    return quantize(v, b.min, b.max, finite(run?.props.get().step, 1));
  };
  const publish = () => {
    if (!run) return false;
    const current = run;
    const p = run.props.get(),
      b = bounds();
    disabled.set(
      !!p.disabled || !!run.context.tryRead(FIELD_CONTEXT)?.disabled,
      'reason: slider policy'
    );
    if (run !== current) return false;
    readOnly.set(
      !!p.readOnly || !!run.context.tryRead(FIELD_CONTEXT)?.readOnly,
      'reason: slider policy'
    );
    if (run !== current) return false;
    orientation.set(p.orientation ?? 'horizontal', 'reason: slider orientation');
    if (run !== current) return false;
    percentageState.set(percentage(value.get(), b.min, b.max), 'reason: slider ratio');
    if (run !== current) return false;
    run.context.update(SLIDER_CONTEXT, {
      value: value.get(),
      interactionPhase,
      ...b,
      step: finite(p.step, 1),
      percentage: percentageState.get(),
      disabled: disabled.get(),
      readOnly: readOnly.get(),
      controlDisabled: !!p.disabled,
      controlReadOnly: !!p.readOnly,
      orientation: p.orientation ?? 'horizontal',
      direction: p.direction ?? 'ltr',
      valueText: p.valueText || String(value.get()),
      label: p.ariaLabel ?? '',
    });
    return run === current;
  };
  const cancel = () => {
    if (!dragging.get()) return;
    dragging.set(false, 'reason: slider interaction canceled');
    interactionPhase = 'cancel';
    if (run && !run.props.isProvided('value')) {
      value.set(normalize(initial), 'reason: slider cancel restores start');
      if (publish()) run.expose.emit('valueChange', { value: value.get() });
    } else publish();
  };
  // A removed input part cannot finish its own session after its anatomy lease
  // ends. The existing Root owns cancellation when either required part leaves.
  for (const role of ['track', 'thumb'])
    def.anatomy.subscribeParts(SLIDER_FAMILY, role, (_run, parts) => {
      if (parts.length === 0) cancel();
    });
  def.expose.method('beginInteraction', () => {
    if (!run || dragging.get() || disabled.get() || readOnly.get()) return false;
    if (
      run.anatomy.partsOf(SLIDER_FAMILY, 'track').length !== 1 ||
      run.anatomy.partsOf(SLIDER_FAMILY, 'thumb').length !== 1
    )
      return false;
    initial = value.get();
    dragging.set(true, 'reason: slider interaction start');
    interactionPhase = 'active';
    return publish();
  });
  def.expose.method('requestValue', (next) => {
    if (!run || disabled.get() || readOnly.get() || !Number.isFinite(next)) return false;
    const current = run;
    next = normalize(next);
    if (next === value.get()) return false;
    if (!run.props.isProvided('value')) value.set(next, 'reason: slider accepted value');
    if (run !== current || !publish()) return false;
    run.expose.emit('valueChange', { value: next });
    if (run !== current) return false;
    const report = run?.anatomy.partsOf(SLIDER_FAMILY, 'thumb')[0]?.getExpose('__fieldInput');
    if (typeof report === 'function') report();
    return true;
  });
  def.expose.method('commitValue', () => {
    if (!run || disabled.get() || readOnly.get()) return;
    dragging.set(false, 'reason: slider commit');
    interactionPhase = 'commit';
    if (!publish()) return;
    run.expose.emit('valueCommit', { value: value.get() });
  });
  def.expose.method('cancelInteraction', cancel);
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.event('valueCommit', { payload: 'json' });
  def.context.trySubscribe(FIELD_CONTEXT, () => publish());
  let initialValue: number = 0;
  def.expose.method('resetValue', () => {
    if (!run) return false;
    const current = run;
    const next = normalize(initialValue);
    if (!run.props.isProvided('value')) value.set(next, 'reason: slider value reset');
    if (run !== current) return false;
    dragging.set(false, 'reason: slider reset cancels gesture');
    interactionPhase = 'cancel';
    if (!publish()) return false;
    if (run.props.isProvided('value')) run.expose.emit('valueChange', { value: next });
    return true;
  });
  def.lifecycle.onCreated((current) => {
    run = current;
    value.set(
      normalize(
        current.props.isProvided('value')
          ? finite(current.props.get().value, 0)
          : finite(current.props.get().defaultValue, 0)
      ),
      'reason: slider initial value'
    );
    initialValue = value.get();
    publish();
  });
  def.lifecycle.onMounted((current) => {
    run = current;
    publish();
  });
  def.props.watchAll((current) => {
    run = current;
    if (current.props.isProvided('value'))
      value.set(normalize(finite(current.props.get().value, 0)), 'reason: slider controlled value');
    else value.set(normalize(value.get()), 'reason: slider new bounds');
    if (run !== current) return;
    if (current.props.get().disabled || current.props.get().readOnly) cancel();
    publish();
  });
  def.lifecycle.onUnmounted(() => {
    cancel();
    run = null;
  });
  def.lifecycle.onBeforeDispose(() => {
    run = null;
  });
  return (r: RendererHandle<any>) => r.slot();
}
export const asSliderRoot = defineAsHook<
  SliderRootProps,
  SliderRootExposes,
  SliderRootAsHookContract
>({ name: 'as-slider-root', setup });
export default definePrototype({ name: 'base-slider-root', setup });
