import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
  type RendererHandle,
} from '@proto.ui/core';
import { finite, range, quantize } from '../progress/range';
import { NUMBER_FIELD_CONTEXT, NUMBER_FIELD_FAMILY } from './shared';
import type {
  NumberFieldRootProps,
  NumberFieldRootExposes,
  NumberFieldRootAsHookContract,
} from './types';
function setup(def: DefHandle<NumberFieldRootProps, NumberFieldRootExposes>) {
  def.anatomy.claim(NUMBER_FIELD_FAMILY, { role: 'root' });
  def.props.define({
    value: { type: 'number', empty: 'fallback' },
    defaultValue: { type: 'number', empty: 'fallback' },
    min: { type: 'number', empty: 'fallback' },
    max: { type: 'number', empty: 'fallback' },
    step: { type: 'number', empty: 'fallback', validator: (v) => Number.isFinite(v) && v > 0 },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    ariaLabel: { type: 'string', empty: 'fallback' },
    name: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultValue: 0,
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    readOnly: false,
    ariaLabel: '',
    name: '',
  });
  const value = def.state.numberDiscrete('value', 0),
    draft = def.state.string('draft', '0'),
    disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false);
  def.expose.state('value', value);
  def.expose.state('draft', draft);
  def.expose.state('disabled', disabled);
  def.expose.state('readOnly', readOnly);
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.event('valueCommit', { payload: 'json' });
  def.context.provide(NUMBER_FIELD_CONTEXT, {
    value: 0,
    draft: '0',
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    readOnly: false,
    label: '',
    name: '',
  });
  let run: RunHandle<NumberFieldRootProps> | null = null;
  const normalize = (v: number) => {
    const p = run?.props.get(),
      b = range(p?.min, p?.max);
    return quantize(v, b.min, b.max, finite(p?.step, 1));
  };
  const publish = () => {
    if (!run) return;
    const p = run.props.get();
    disabled.set(!!p.disabled, 'reason: number policy');
    readOnly.set(!!p.readOnly, 'reason: number policy');
    run.context.update(NUMBER_FIELD_CONTEXT, {
      value: value.get(),
      draft: draft.get(),
      ...range(p.min, p.max),
      step: finite(p.step, 1),
      disabled: disabled.get(),
      readOnly: readOnly.get(),
      label: p.ariaLabel ?? '',
      name: p.name ?? '',
    });
  };
  const request = (next: number) => {
    if (!run || disabled.get() || readOnly.get() || !Number.isFinite(next)) return false;
    next = normalize(next);
    if (next === value.get()) return false;
    if (!run.props.isProvided('value')) value.set(next, 'reason: number accepted value');
    publish();
    run.expose.emit('valueChange', { value: next });
    return true;
  };
  def.expose.method('requestValue', (next) => {
    const changed = request(next);
    draft.set(String(value.get()), 'reason: number public request text');
    publish();
    return changed;
  });
  const commit = () => {
    if (!run || disabled.get() || readOnly.get()) return;
    const text = draft.get().trim();
    if (text !== '' && Number.isFinite(Number(text))) request(Number(text));
    draft.set(String(value.get()), 'reason: number canonical commit');
    publish();
    run.expose.emit('valueCommit', { value: value.get() });
  };
  def.expose.method('requestInput', (text, composing = false) => {
    if (!run || disabled.get() || readOnly.get() || typeof text !== 'string') return false;
    draft.set(text, 'reason: number draft input');
    publish();
    if (!composing && text.trim() !== '' && Number.isFinite(Number(text))) request(Number(text));
    return true;
  });
  def.expose.method('commitValue', commit);
  def.expose.method('stepBy', (direction) => {
    if (!Number.isFinite(direction)) return false;
    const changed = request(value.get() + direction * finite(run?.props.get().step, 1));
    draft.set(String(value.get()), 'reason: number step');
    publish();
    if (changed) run?.expose.emit('valueCommit', { value: value.get() });
    return changed;
  });
  def.lifecycle.onCreated((current) => {
    run = current;
    value.set(
      normalize(
        finite(
          current.props.isProvided('value')
            ? current.props.get().value
            : current.props.get().defaultValue,
          0
        )
      ),
      'reason: number initialize'
    );
    draft.set(String(value.get()), 'reason: number initialize text');
    publish();
  });
  def.lifecycle.onMounted((current) => {
    run = current;
    publish();
  });
  def.props.watchAll((current) => {
    run = current;
    value.set(
      normalize(
        current.props.isProvided('value') ? finite(current.props.get().value, 0) : value.get()
      ),
      'reason: number controlled or bounds'
    );
    draft.set(String(value.get()), 'reason: number owner text');
    publish();
  });
  def.lifecycle.onUnmounted(() => {
    run = null;
  });
  return (r: RendererHandle<any>) => r.slot();
}
export const asNumberFieldRoot = defineAsHook<
  NumberFieldRootProps,
  NumberFieldRootExposes,
  NumberFieldRootAsHookContract
>({ name: 'as-number-field-root', setup });
export default definePrototype({ name: 'base-number-field-root', setup });
