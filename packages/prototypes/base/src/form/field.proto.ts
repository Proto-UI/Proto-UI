import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asFieldRoot } from '../field/root.proto';
import { FIELD_FAMILY, copyFieldValue } from '../field/shared';
import type { FieldControlSnapshot } from '../field/shared';
import { FORM_FAMILY, FORM_CONTEXT, formMethod } from './shared';
import type { FormFieldProps, FormFieldExposes, FormFieldAsHookContract } from './types';
function setup(def: DefHandle<FormFieldProps, FormFieldExposes>) {
  const inherited = asFieldRoot();
  def.anatomy.claim(FORM_FAMILY, { role: 'field' });
  def.props.define({ name: { type: 'string', empty: 'fallback' } });
  def.props.setDefaults({ name: '' });
  let run: RunHandle<FormFieldProps> | null = null;
  def.expose.method('__formReset', () => {
    const control = run?.anatomy.partsOf(FIELD_FAMILY, 'control')[0];
    const reset = control?.getExpose('resetValue');
    if (typeof reset !== 'function') return false;
    reset();
    (inherited.getMethod!('resetValidation') as () => void)();
    return true;
  });
  def.expose.method('__formField', () => {
    const get = run?.anatomy.partsOf(FIELD_FAMILY, 'control')[0]?.getExpose('__fieldSnapshot');
    const snapshot: FieldControlSnapshot | null = typeof get === 'function' ? get() : null;
    return {
      name: run?.props.get().name ?? '',
      value: copyFieldValue(snapshot?.value ?? null),
      disabled: inherited.stateHandles!.disabled.get(),
      available: !!snapshot?.active,
      implicitSubmit: (() => {
        const eligible = run?.anatomy
          .partsOf(FIELD_FAMILY, 'control')[0]
          ?.getExpose('__implicitSubmitEligible');
        return typeof eligible === 'function' && eligible() === true;
      })(),
      validity: (
        inherited.getMethod!('getValidity') as () => import('../field/types').FieldValiditySnapshot
      )(),
    };
  });
  const notify = (current: RunHandle<FormFieldProps>) => {
    run = current;
    formMethod(current, '__fieldChanged');
  };
  for (const state of Object.values(inherited.stateHandles!))
    state.watch((current, event) => {
      if (event.type === 'next') notify(current);
    });
  def.context.trySubscribe(FORM_CONTEXT, () => {});
  def.lifecycle.onMounted(notify);
  def.lifecycle.onUpdated(notify);
  def.props.watchAll(notify);
  def.lifecycle.onUnmounted(() => {
    run = null;
  });
  return inherited.render;
}
export const asFormField = defineAsHook<FormFieldProps, FormFieldExposes, FormFieldAsHookContract>({
  name: 'as-form-field',
  setup,
});
export default definePrototype({ name: 'base-form-field', setup });
