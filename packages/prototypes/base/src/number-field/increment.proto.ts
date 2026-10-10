import type { NumberFieldStepExposes } from './types';
import type { State } from '@proto.ui/core';
import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
  type RendererHandle,
} from '@proto.ui/core';
import { asAccessible, asFocusable, asTrigger } from '@proto.ui/hooks';
import { NUMBER_FIELD_CONTEXT, NUMBER_FIELD_FAMILY, numberFieldMethod } from './shared';
import type { NumberFieldPartProps } from './types';
function setup(def: DefHandle<NumberFieldPartProps>) {
  def.anatomy.claim(NUMBER_FIELD_FAMILY, { role: 'increment' });
  asTrigger();
  const focus = asFocusable<NumberFieldPartProps>();
  focus.configure({ disabled: false });
  const disabled = def.state.bool('disabled', false);
  def.expose.state('disabled', disabled);
  def.expose.state('focusVisible', focus.focusVisible);
  const a = asAccessible();
  a.role('button');
  a.nameFromContent();
  a.state('disabled', disabled);
  const sync = (run: RunHandle<NumberFieldPartProps>) => {
    const c = run.context.read(NUMBER_FIELD_CONTEXT);
    disabled.set(c.disabled || c.readOnly || c.value >= c.max, 'reason: number step availability');
    focus.setDisabled(disabled.get());
  };
  def.context.subscribe(NUMBER_FIELD_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.event.on('press.commit', (run) => {
    if (!disabled.get()) numberFieldMethod(run, 'stepBy', 1);
  });
  return (r: RendererHandle<any>) => r.slot();
}
export const asNumberFieldIncrement = defineAsHook<
  NumberFieldPartProps,
  NumberFieldStepExposes,
  { state: { disabled: State<boolean>; focusVisible: State<boolean> } }
>({ name: 'as-number-field-increment', setup });
export default definePrototype<NumberFieldPartProps, NumberFieldStepExposes>({
  name: 'base-number-field-increment',
  setup,
});
