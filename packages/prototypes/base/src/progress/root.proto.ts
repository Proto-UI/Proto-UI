import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
  type RendererHandle,
} from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { PROGRESS_FAMILY, PROGRESS_CONTEXT } from './shared';
import { range, finite, clamp, percentage } from './range';
import type { ProgressRootProps, ProgressRootExposes, ProgressRootAsHookContract } from './types';
function setup(def: DefHandle<ProgressRootProps, ProgressRootExposes>) {
  def.anatomy.claim(PROGRESS_FAMILY, { role: 'root' });
  def.props.define({
    value: { type: 'number', empty: 'fallback' },
    min: { type: 'number', empty: 'fallback' },
    max: { type: 'number', empty: 'fallback' },
    ariaLabel: { type: 'string', empty: 'fallback' },
    valueText: { type: 'string', empty: 'fallback' },
    indeterminate: { type: 'boolean', empty: 'fallback' },
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
  a11y.role('progressbar');
  a11y.name(label);
  a11y.state('valueMin', valueMin);
  a11y.state('valueMax', valueMax);
  a11y.state('valueNow', valueNow);
  a11y.state('valueText', valueText);
  a11y.relation('labelledBy', {
    target: { kind: 'part', family: PROGRESS_FAMILY, role: 'label', key: 'label' },
  });
  def.context.provide(PROGRESS_CONTEXT, {
    value: 0,
    percentage: 0,
    indeterminate: false,
    status: '',
    valueText: '',
  });
  const sync = (run: RunHandle<ProgressRootProps>) => {
    const p = run.props.get(),
      bounds = range(p.min, p.max),
      value = clamp(finite(p.value, bounds.min), bounds.min, bounds.max);
    const indeterminate = p.indeterminate === true || !run.props.isProvided('value');
    const status = indeterminate ? 'indeterminate' : value >= bounds.max ? 'complete' : 'loading';
    const next = {
      value,
      percentage: indeterminate ? 0 : percentage(value, bounds.min, bounds.max),
      indeterminate,
      status,
      valueText: p.valueText || (indeterminate ? '' : String(value)),
    };
    for (const key of Object.keys(states) as (keyof typeof states)[])
      states[key].set(next[key] as never, 'reason: progress range synchronization');
    label.set(p.ariaLabel ?? '', 'reason: progress name');
    valueMin.set(bounds.min, 'reason: progress minimum');
    valueMax.set(bounds.max, 'reason: progress maximum');
    valueNow.set(indeterminate ? '' : String(value), 'reason: progress current value');
    valueText.set(next.valueText, 'reason: progress value text');
    run.context.update(PROGRESS_CONTEXT, next);
  };
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  return (r: RendererHandle<any>) => r.slot();
}
export const asProgressRoot = defineAsHook<
  ProgressRootProps,
  ProgressRootExposes,
  ProgressRootAsHookContract
>({ name: 'as-progress-root', setup });
export default definePrototype({ name: 'base-progress-root', setup });
