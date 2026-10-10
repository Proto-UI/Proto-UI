import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
  type RendererHandle,
} from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { METER_FAMILY, METER_CONTEXT } from './shared';
import { range, finite, clamp, percentage } from '../progress/range';
import type { MeterRootProps, MeterRootExposes, MeterRootAsHookContract } from './types';
function setup(def: DefHandle<MeterRootProps, MeterRootExposes>) {
  def.anatomy.claim(METER_FAMILY, { role: 'root' });
  def.props.define({
    value: { type: 'number', empty: 'fallback' },
    min: { type: 'number', empty: 'fallback' },
    max: { type: 'number', empty: 'fallback' },
    ariaLabel: { type: 'string', empty: 'fallback' },
    valueText: { type: 'string', empty: 'fallback' },
    low: { type: 'number', empty: 'fallback' },
    high: { type: 'number', empty: 'fallback' },
    optimum: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({ min: 0, max: 100, ariaLabel: '', valueText: '' });
  const states = {
    value: def.state.numberDiscrete('value', 0),
    percentage: def.state.numberRange('percentage', 0, { min: 0, max: 100 }),
    indeterminate: def.state.bool('indeterminate', false),
    status: def.state.string('status', ''),
  };
  for (const key of Object.keys(states) as (keyof typeof states)[])
    def.expose.state(key, states[key]);
  const label = def.state.string('ariaLabel', '');
  const valueMin = def.state.numberDiscrete('valueMin', 0),
    valueMax = def.state.numberDiscrete('valueMax', 100),
    valueNow = def.state.string('valueNow', ''),
    valueText = def.state.string('valueText', '');
  const a11y = asAccessible();
  a11y.role('meter');
  a11y.name(label);
  a11y.state('valueMin', valueMin);
  a11y.state('valueMax', valueMax);
  a11y.state('valueNow', valueNow);
  a11y.state('valueText', valueText);
  a11y.relation('labelledBy', {
    target: { kind: 'part', family: METER_FAMILY, role: 'label', key: 'label' },
  });
  def.context.provide(METER_CONTEXT, {
    value: 0,
    percentage: 0,
    indeterminate: false,
    status: '',
    valueText: '',
  });
  const sync = (run: RunHandle<MeterRootProps>) => {
    const p = run.props.get(),
      bounds = range(p.min, p.max),
      value = clamp(finite(p.value, bounds.min), bounds.min, bounds.max);
    const indeterminate = false;
    const low = clamp(finite(p.low, bounds.min), bounds.min, bounds.max);
    const high = clamp(finite(p.high, bounds.max), low, bounds.max);
    const optimum = clamp(finite(p.optimum, (bounds.min + bounds.max) / 2), bounds.min, bounds.max);
    const zone = value < low ? 0 : value > high ? 2 : 1;
    const ideal = optimum < low ? 0 : optimum > high ? 2 : 1;
    const status =
      zone === ideal ? 'optimal' : Math.abs(zone - ideal) === 2 ? 'critical' : 'suboptimal';
    const next = {
      value,
      percentage: indeterminate ? 0 : percentage(value, bounds.min, bounds.max),
      indeterminate,
      status,
      valueText: p.valueText || (indeterminate ? '' : String(value)),
    };
    for (const key of Object.keys(states) as (keyof typeof states)[])
      states[key].set(next[key] as never, 'reason: meter range synchronization');
    label.set(p.ariaLabel ?? '', 'reason: meter name');
    valueMin.set(bounds.min, 'reason: meter minimum');
    valueMax.set(bounds.max, 'reason: meter maximum');
    valueNow.set(indeterminate ? '' : String(value), 'reason: meter current value');
    valueText.set(next.valueText, 'reason: meter value text');
    run.context.update(METER_CONTEXT, next);
  };
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  return (r: RendererHandle<any>) => r.slot();
}
export const asMeterRoot = defineAsHook<MeterRootProps, MeterRootExposes, MeterRootAsHookContract>({
  name: 'as-meter-root',
  setup,
});
export default definePrototype({ name: 'base-meter-root', setup });
