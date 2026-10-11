import { defineAsHook, definePrototype, type DefHandle, type RendererHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { METER_FAMILY, METER_CONTEXT } from './shared';
import type { MeterPartProps, MeterPartExposes, MeterRootAsHookContract } from './types';
function setup(def: DefHandle<MeterPartProps, MeterPartExposes>) {
  def.anatomy.claim(METER_FAMILY, { role: 'label' });
  asAccessible().part(METER_FAMILY, { key: 'label' });
  const states = {
    value: def.state.numberDiscrete('value', 0),
    percentage: def.state.numberRange('percentage', 0, { min: 0, max: 100 }),
    indeterminate: def.state.bool('indeterminate', false),
    status: def.state.string('status', ''),
  };
  for (const key of Object.keys(states) as (keyof typeof states)[])
    def.expose.state(key, states[key]);
  let text = '';
  const sync = (run: import('@proto.ui/core').RunHandle<MeterPartProps>) => {
    const next = run.context.read(METER_CONTEXT);
    for (const key of Object.keys(states) as (keyof typeof states)[])
      states[key].set(next[key] as never, 'reason: meter part context');
    if (text !== next.valueText) {
      text = next.valueText;
      run.update();
    }
  };
  def.context.subscribe(METER_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  return (r: RendererHandle<any>) => r.slot();
}
export const asMeterLabel = defineAsHook<MeterPartProps, MeterPartExposes, MeterRootAsHookContract>(
  { name: 'as-meter-label', setup }
);
export default definePrototype({ name: 'base-meter-label', setup });
