import type { DefHandle, RendererHandle, RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable } from '@proto.ui/hooks';
import { percentage } from '../progress/range';
import { SLIDER_VALUES_CONTEXT, SLIDER_VALUES_FAMILY, sliderValuesMethod } from './values-shared';
import type { SliderValuesPartProps } from './values-types';

export function setupSliderValuesPart(def: DefHandle<SliderValuesPartProps>, role: string) {
  def.anatomy.claim(SLIDER_VALUES_FAMILY, { role });
  def.props.define({
    index: { type: 'number', empty: 'fallback' },
    startIndex: { type: 'number', empty: 'fallback' },
    endIndex: { type: 'number', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    ariaLabel: { type: 'string', empty: 'fallback' },
    valueText: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false, readOnly: false, ariaLabel: '', valueText: '' });
  const value = def.state.numberDiscrete('value', 0),
    ratio = def.state.numberRange('percentage', 0, { min: 0, max: 100 });
  const startPercentage = def.state.numberRange('startPercentage', 0, { min: 0, max: 100 }),
    endPercentage = def.state.numberRange('endPercentage', 0, { min: 0, max: 100 }),
    extent = def.state.numberRange('extent', 0, { min: 0, max: 100 });
  const index = def.state.numberDiscrete('index', -1),
    disabled = def.state.bool('disabled', true),
    readOnly = def.state.bool('readOnly', false);
  const orientation = def.state.string('orientation', 'horizontal'),
    direction = def.state.string('direction', 'ltr');
  const min = def.state.numberDiscrete('min', 0),
    max = def.state.numberDiscrete('max', 100),
    name = def.state.string('name', ''),
    text = def.state.string('text', '');
  const projectionRevision = def.state.numberDiscrete('projectionRevision', 0);
  const rootAvailable = def.state.bool('rootAvailable', false),
    retired = def.state.bool('retired', false);
  const a11y = asAccessible(),
    focus = role === 'thumb' ? asFocusable<SliderValuesPartProps>() : null;
  const hovered = focus ? def.state.bool('hovered', false) : null;
  let run: RunHandle<SliderValuesPartProps> | null = null;
  const alive = () => !!run && !retired.get();
  const active = () => alive() && rootAvailable.get();
  for (const [key, handle] of Object.entries({
    value,
    percentage: ratio,
    startPercentage,
    endPercentage,
    extent,
    index,
    disabled,
    readOnly,
    orientation,
    direction,
  }))
    def.expose.state(key, handle);
  const slotIndex = (current: RunHandle<SliderValuesPartProps>) =>
    current.props.get().index ?? current.anatomy.order.indexOfSelf(SLIDER_VALUES_FAMILY, 'thumb');
  if (focus) {
    focus.configure({ disabled: true });
    def.expose.state('focusVisible', focus.focusVisible);
    def.expose.state('hovered', hovered!);
    def.expose.method('focusSelf', () => {
      if (active() && !disabled.get()) focus.focusSelf();
    });
    def.expose.method('getSlotInfo', () => ({
      index: run && !retired.get() ? slotIndex(run) : -1,
      disabled: !run || retired.get() || !!run.props.get().disabled,
      readOnly: !!run?.props.get().readOnly,
    }));
    a11y.role('slider');
    a11y.name(name);
    a11y.state('valueMin', min);
    a11y.state('valueMax', max);
    a11y.state('valueNow', value);
    a11y.state('valueText', text);
    a11y.state('orientation', orientation);
    a11y.state('disabled', disabled);
    a11y.state('readOnly', readOnly);
    a11y.relation('labelledBy', {
      target: { kind: 'part', family: SLIDER_VALUES_FAMILY, role: 'label', key: 'label' },
    });
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered!.set(true);
    });
    def.event.on('pointer.leave', () => hovered!.set(false));
  } else if (role === 'label') a11y.part(SLIDER_VALUES_FAMILY, { key: 'label' });
  else if (role === 'indicator' || role === 'value') a11y.tree({ hidden: true });
  const nextProjection = () => {
    const next = (projectionRevision.get() + 1) % Number.MAX_SAFE_INTEGER;
    projectionRevision.set(next);
    return next;
  };
  const disable = (retiring = false) => {
    const revision = nextProjection();
    const current = () => (retiring ? !!run : alive()) && projectionRevision.get() === revision;
    disabled.set(true);
    if (!current()) return;
    hovered?.set(false);
    if (!current()) return;
    focus?.setDisabled(true);
  };
  const sync = (current: RunHandle<SliderValuesPartProps>) => {
    run = current;
    // Required Context remains strict. Only an observed provider retirement is
    // allowed to suppress later callbacks; initial live orphans still throw.
    const c = current.context.read(SLIDER_VALUES_CONTEXT),
      p = current.props.get();
    if (!active()) {
      if (alive()) disable();
      return;
    }
    // A newer Context/Props/Anatomy projection can run synchronously inside
    // any exposed State observer. Its declared generation supersedes this
    // frame even when both the node and a new Root remain alive.
    const revision = nextProjection();
    const currentProjection = () => active() && projectionRevision.get() === revision;
    const selected = focus ? slotIndex(current) : 0;
    const validSlot = Number.isInteger(selected) && selected >= 0 && selected < c.values.length;
    index.set(selected);
    if (!currentProjection()) return;
    const nextValue = validSlot ? c.values[selected] : 0;
    value.set(nextValue);
    if (!currentProjection()) return;
    ratio.set(validSlot ? percentage(nextValue, c.min, c.max) : 0);
    if (!currentProjection()) return;
    let start = c.min,
      end = c.values.length ? c.values[c.values.length - 1] : c.min,
      validSegment = c.values.length > 0;
    if (c.values.length > 1) start = c.values[0];
    if (p.startIndex != null) {
      validSegment =
        validSegment &&
        Number.isInteger(p.startIndex) &&
        p.startIndex >= 0 &&
        p.startIndex < c.values.length;
      start = validSegment ? c.values[p.startIndex] : c.min;
    }
    if (p.endIndex != null) {
      validSegment =
        validSegment &&
        Number.isInteger(p.endIndex) &&
        p.endIndex >= 0 &&
        p.endIndex < c.values.length;
      end = validSegment ? c.values[p.endIndex] : c.min;
    }
    if (p.startIndex != null && p.endIndex != null && p.startIndex > p.endIndex)
      validSegment = false;
    const from = validSegment ? percentage(start, c.min, c.max) : 0,
      to = validSegment ? percentage(end, c.min, c.max) : 0;
    startPercentage.set(from);
    if (!currentProjection()) return;
    endPercentage.set(to);
    if (!currentProjection()) return;
    extent.set(Math.max(0, to - from));
    if (!currentProjection()) return;
    const off =
      !!p.disabled ||
      c.disabled ||
      !c.ready ||
      (focus ? !validSlot || !c.mappingReady : role === 'indicator' && !validSegment);
    disabled.set(off);
    if (!currentProjection()) return;
    readOnly.set(!!p.readOnly || c.readOnly);
    if (!currentProjection()) return;
    orientation.set(c.orientation);
    if (!currentProjection()) return;
    direction.set(c.direction);
    if (!currentProjection()) return;
    min.set(c.min);
    if (!currentProjection()) return;
    max.set(c.max);
    if (!currentProjection()) return;
    name.set(p.ariaLabel || c.label);
    if (!currentProjection()) return;
    text.set(role === 'value' ? c.values.join(', ') : p.valueText || String(nextValue));
    if (!currentProjection()) return;
    focus?.setDisabled(off);
    if (!currentProjection()) return;
    if (off) hovered?.set(false);
    if (!currentProjection()) return;
    if (role === 'value') current.update();
  };
  const safeSync = (current: RunHandle<SliderValuesPartProps>) => {
    if (active()) sync(current);
  };
  const notify = (current: RunHandle<SliderValuesPartProps>) => {
    if (role === 'thumb' && active()) sliderValuesMethod(current, 'invalidateParts');
  };
  def.context.subscribe(SLIDER_VALUES_CONTEXT, (current) => safeSync(current));
  def.props.watchAll((current) => {
    run = current;
    safeSync(current);
    notify(current);
  });
  def.anatomy.subscribeParts(SLIDER_VALUES_FAMILY, 'root', (current, parts) => {
    run = current;
    rootAvailable.set(parts.length > 0);
    if (!rootAvailable.get()) {
      disable();
      return;
    }
    safeSync(current);
  });
  if (focus)
    def.anatomy.subscribeParts(SLIDER_VALUES_FAMILY, 'thumb', (current) => safeSync(current));
  def.lifecycle.onCreated((current) => {
    run = current;
    // Initial Context read remains strict; availability is revoked only by
    // observed Anatomy retirement, including during a projection callback.
    rootAvailable.set(true);
    sync(current);
  });
  def.lifecycle.onMounted((current) => {
    run = current;
    retired.set(false);
    rootAvailable.set(current.anatomy.partsOf(SLIDER_VALUES_FAMILY, 'root').length > 0);
    sync(current);
    notify(current);
  });
  def.lifecycle.onUnmounted(() => {
    retired.set(true);
    rootAvailable.set(false);
    disable(true);
    run = null;
  });
  def.lifecycle.onBeforeDispose(() => {
    run = null;
    retired.set(true);
  });
  if (focus)
    def.event.onGlobal('key.down', (current, event) => {
      if (
        !active() ||
        typeof event.key !== 'string' ||
        !focus.focused.get() ||
        disabled.get() ||
        readOnly.get() ||
        retired.get() ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (
        ![
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'PageUp',
          'PageDown',
          'Home',
          'End',
        ].includes(event.key)
      )
        return;
      event.control.requestDefaultActionPrevention({
        reason: 'slider-values.keyboard',
        source: 'base-slider-values-thumb',
      });
      sliderValuesMethod(
        current,
        'requestKeyboardValue',
        slotIndex(current),
        event.key,
        event.shiftKey
      );
    });
  return (r: RendererHandle<any>) => (role === 'value' ? text.get() : r.slot());
}
