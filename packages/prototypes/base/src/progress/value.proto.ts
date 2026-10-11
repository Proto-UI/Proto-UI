import { defineAsHook, definePrototype, type DefHandle, type RendererHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { PROGRESS_FAMILY, PROGRESS_CONTEXT } from './shared';
import type { ProgressPartProps, ProgressPartExposes, ProgressRootAsHookContract } from './types';
function setup(def: DefHandle<ProgressPartProps, ProgressPartExposes>) {
  def.anatomy.claim(PROGRESS_FAMILY, { role: 'value' });
  asAccessible().tree({ hidden: true });
  const states = {
    value: def.state.numberDiscrete('value', 0),
    percentage: def.state.numberRange('percentage', 0, { min: 0, max: 100 }),
    indeterminate: def.state.bool('indeterminate', false),
    status: def.state.string('status', ''),
  };
  for (const key of Object.keys(states) as (keyof typeof states)[])
    def.expose.state(key, states[key]);
  let text = '';
  const sync = (run: import('@proto.ui/core').RunHandle<ProgressPartProps>) => {
    const next = run.context.read(PROGRESS_CONTEXT);
    for (const key of Object.keys(states) as (keyof typeof states)[])
      states[key].set(next[key] as never, 'reason: progress part context');
    if (text !== next.valueText) {
      text = next.valueText;
      run.update();
    }
  };
  def.context.subscribe(PROGRESS_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  return (r: RendererHandle<any>) => text;
}
export const asProgressValue = defineAsHook<
  ProgressPartProps,
  ProgressPartExposes,
  ProgressRootAsHookContract
>({ name: 'as-progress-value', setup });
export default definePrototype({ name: 'base-progress-value', setup });
