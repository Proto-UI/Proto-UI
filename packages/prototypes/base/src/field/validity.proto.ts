import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { FIELD_CONTEXT, FIELD_FAMILY, EMPTY_VALIDITY, copyValidity } from './shared';
import type {
  FieldValidityProps,
  FieldValidityExposes,
  FieldValidityAsHookContract,
  FieldValiditySnapshot,
} from './types';
function setup(def: DefHandle<FieldValidityProps, FieldValidityExposes>) {
  def.anatomy.claim(FIELD_FAMILY, { role: 'validity' });
  const states = {
    invalid: def.state.bool('invalid', false),
    pending: def.state.bool('pending', false),
    dirty: def.state.bool('dirty', false),
    touched: def.state.bool('touched', false),
    filled: def.state.bool('filled', false),
    focused: def.state.bool('focused', false),
  };
  for (const key of Object.keys(states) as (keyof typeof states)[])
    def.expose.state(key, states[key]);
  let snapshot: FieldValiditySnapshot = copyValidity(EMPTY_VALIDITY);
  def.expose.method('getValidity', () => copyValidity(snapshot));
  const sync = (run: import('@proto.ui/core').RunHandle<FieldValidityProps>) => {
    snapshot = copyValidity(run.context.read(FIELD_CONTEXT));
    for (const key of Object.keys(states) as (keyof typeof states)[])
      states[key].set(snapshot[key], 'reason: field validity ' + key);
  };
  def.context.subscribe(FIELD_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onUpdated(sync);
  return (r: import('@proto.ui/core').RendererHandle<any>) => r.slot();
}
export const asFieldValidity = defineAsHook<
  FieldValidityProps,
  FieldValidityExposes,
  FieldValidityAsHookContract
>({ name: 'as-field-validity', setup });
export default definePrototype({ name: 'base-field-validity', setup });
