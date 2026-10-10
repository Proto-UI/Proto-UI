import { type DefHandle, type RendererHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable } from '@proto.ui/hooks';
import { SLIDER_FAMILY, SLIDER_CONTEXT, sliderMethod } from './shared';
import type { SliderPartProps } from './types';
export function setupSliderPart(def: DefHandle<SliderPartProps>, role: string) {
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
    a.relation('labelledBy', {
      target: { kind: 'part', family: SLIDER_FAMILY, role: 'label', key: 'label' },
    });
  } else if (role === 'label') a.part(SLIDER_FAMILY, { key: 'label' });
  else if (role === 'indicator' || role === 'value') a.tree({ hidden: true });
  const sync = (run: RunHandle<SliderPartProps>) => {
    const c = run.context.read(SLIDER_CONTEXT);
    value.set(c.value, 'reason: slider part');
    percentage.set(c.percentage, 'reason: slider part');
    disabled.set(c.disabled, 'reason: slider policy');
    readOnly.set(c.readOnly, 'reason: slider policy');
    orientation.set(c.orientation, 'reason: slider part');
    direction.set(c.direction, 'reason: slider direction');
    min.set(c.min, 'reason: slider bound');
    max.set(c.max, 'reason: slider bound');
    label.set(c.label, 'reason: slider label');
    text.set(c.valueText, 'reason: slider text');
    focus?.setDisabled(c.disabled);
    if (role === 'value') run.update();
  };
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
