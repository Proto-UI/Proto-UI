import { asFieldControl } from '../field/control-binding.proto';
import { FIELD_LABEL_PAIR } from '../field/shared';
import { type DefHandle, type RendererHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asControlLabel } from '@proto.ui/hooks';
import { SLIDER_FAMILY, SLIDER_CONTEXT, sliderMethod } from './shared';
import type { SliderPartProps } from './types';
export function setupSliderPart(def: DefHandle<SliderPartProps>, role: string, field = false) {
  const binding = field ? asFieldControl() : null;
  def.anatomy.claim(SLIDER_FAMILY, { role });
  const value = def.state.numberDiscrete('value', 0),
    percentage = def.state.numberRange('percentage', 0, { min: 0, max: 100 }),
    disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false),
    orientation = def.state.string('orientation', 'horizontal'),
    direction = def.state.string('direction', 'ltr'),
    min = def.state.numberDiscrete('min', 0),
    max = def.state.numberDiscrete('max', 100),
    text = def.state.string('valueText', ''),
    label = def.state.string('label', '');
  for (const [key, s] of Object.entries({
    value,
    percentage,
    disabled,
    readOnly,
    orientation,
    direction,
  }))
    def.expose.state(key, s);
  const a = asAccessible();
  const focus = role === 'thumb' ? asFocusable<SliderPartProps>() : null;
  const hovered = focus ? def.state.bool('hovered', false) : null;
  const pressed = focus ? def.state.bool('pressed', false) : null;
  let pointerOrigin = false;
  let interactionPhase = 'idle';
  const clearPointer = (reason: string, clearHover = true) => {
    pointerOrigin = false;
    pressed?.set(false, reason);
    if (clearHover) hovered?.set(false, reason);
  };
  if (hovered && pressed) {
    def.expose.state('hovered', hovered);
    def.expose.state('pressed', pressed);
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered.set(true, 'reason: slider pointer hover');
    });
    def.event.on('pointer.leave', () => {
      hovered.set(false, 'reason: slider pointer leave');
      // The Track still owns a captured gesture outside the Thumb's hit box.
      if (interactionPhase !== 'active') clearPointer('reason: slider pointer left');
    });
    def.event.on('pointer.down', () => {
      // No host payload or independent gesture recognizer. Pressed begins only
      // when the existing Root/AxisInput session accepts this pointer origin.
      pointerOrigin = !disabled.get() && !readOnly.get();
    });
    def.event.on('pointer.up', () => clearPointer('reason: slider pointer up', false));
    def.event.on('pointer.cancel', () => clearPointer('reason: slider pointer canceled'));
    def.event.on('press.cancel', () => clearPointer('reason: slider input canceled'));
  }
  if (focus) {
    focus.configure({ disabled: false });
    def.expose.state('focusVisible', focus.focusVisible);
    def.expose.method('focusSelf', () => {
      if (!disabled.get()) focus.focusSelf();
    });
    a.role('slider');
    a.name(label);
    a.state('valueMin', min);
    a.state('valueMax', max);
    a.state('valueNow', value);
    a.state('valueText', text);
    a.state('orientation', orientation);
    a.state('disabled', disabled);
    a.state('readOnly', readOnly);
    if (!field)
      a.relation('labelledBy', {
        target: { kind: 'part', family: SLIDER_FAMILY, role: 'label', key: 'label' },
      });
  } else if (role === 'label') a.part(SLIDER_FAMILY, { key: 'label' });
  else if (role === 'indicator' || role === 'value') a.tree({ hidden: true });
  const sync = (run: RunHandle<SliderPartProps>) => {
    const c = run.context.read(SLIDER_CONTEXT);
    binding?.setPolicy({ disabled: c.controlDisabled, readOnly: c.controlReadOnly });
    value.set(c.value, 'reason: slider part');
    percentage.set(c.percentage, 'reason: slider part');
    disabled.set(c.disabled, 'reason: slider policy');
    readOnly.set(c.readOnly, 'reason: slider policy');
    if (c.disabled || c.readOnly) clearPointer('reason: slider input policy', c.disabled);
    if (interactionPhase !== c.interactionPhase) {
      interactionPhase = c.interactionPhase;
      if (interactionPhase === 'active')
        pressed?.set(pointerOrigin, 'reason: slider accepted pointer session');
      else clearPointer('reason: slider session ended', interactionPhase === 'cancel');
    }
    orientation.set(c.orientation, 'reason: slider part');
    direction.set(c.direction, 'reason: slider direction');
    min.set(c.min, 'reason: slider bound');
    max.set(c.max, 'reason: slider bound');
    label.set(c.label, 'reason: slider label');
    text.set(c.valueText, 'reason: slider text');
    focus?.setDisabled(c.disabled);
    binding?.report({ value: c.value, focused: focus?.focused.get() ?? false, reason: 'sync' });
    if (role === 'value') run.update();
  };
  let currentRun: RunHandle<SliderPartProps> | null = null;
  def.lifecycle.onMounted((run) => {
    currentRun = run;
  });
  def.lifecycle.onUnmounted(() => {
    clearPointer('reason: slider view unmounted');
    currentRun = null;
  });
  if (focus) {
    def.expose.method('resetValue', () =>
      currentRun ? sliderMethod(currentRun, 'resetValue') : false
    );
    def.expose.method('__fieldInput', () => {
      if (currentRun)
        binding?.report({
          value: currentRun.context.read(SLIDER_CONTEXT).value,
          focused: focus.focused.get(),
          reason: 'change',
        });
    });
    focus.focused.watch((run, event) => {
      if (event.type === 'next')
        binding?.report({
          value: run.context.read(SLIDER_CONTEXT).value,
          focused: event.next,
          reason: event.next ? 'sync' : 'blur',
        });
    });
    if (binding)
      asControlLabel().target((_run, request) => {
        if (!disabled.get() && request.isCurrent())
          focus.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
      }, FIELD_LABEL_PAIR);
  }
  def.context.subscribe(SLIDER_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  if (focus)
    def.event.onGlobal('key.down', (run, e) => {
      if (
        !focus.focused.get() ||
        disabled.get() ||
        readOnly.get() ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      const c = run.context.read(SLIDER_CONTEXT);
      let next = c.value;
      const amount = c.step * (e.shiftKey ? 10 : 1);
      if (e.key === 'Home') next = c.min;
      else if (e.key === 'End') next = c.max;
      else if (e.key === 'ArrowUp') next += amount;
      else if (e.key === 'ArrowDown') next -= amount;
      else if (e.key === 'ArrowRight') next += c.direction === 'rtl' ? -amount : amount;
      else if (e.key === 'ArrowLeft') next += c.direction === 'rtl' ? amount : -amount;
      else if (e.key === 'PageUp') next += c.step * 10;
      else if (e.key === 'PageDown') next -= c.step * 10;
      else return;
      e.control.requestDefaultActionPrevention({
        reason: 'slider.keyboard',
        source: 'base-slider-thumb',
      });
      sliderMethod(run, 'requestValue', next);
      sliderMethod(run, 'commitValue');
    });
  return (r: RendererHandle<any>) => (role === 'value' ? text.get() : r.slot());
}
