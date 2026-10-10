import { defineAsHook, definePrototype, type DefHandle, type RendererHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTrigger } from '@proto.ui/hooks';
import { FORM_CONTEXT, FORM_FAMILY, formMethod } from './shared';
import type { FormActionProps } from './types';
function setup(def: DefHandle<FormActionProps>) {
  def.anatomy.claim(FORM_FAMILY, { role: 'reset' });
  asTrigger();
  const focus = asFocusable<FormActionProps>();
  focus.configure({ disabled: false });
  def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
  const disabled = def.state.bool('disabled', false);
  def.expose.state('disabled', disabled);
  def.expose.state('focusVisible', focus.focusVisible);
  const a = asAccessible();
  a.role('button');
  a.nameFromContent();
  a.state('disabled', disabled);
  const sync = (run: import('@proto.ui/core').RunHandle<FormActionProps>) => {
    const ctx = run.context.read(FORM_CONTEXT);
    disabled.set(ctx.disabled || !!run.props.get().disabled, 'reason: reset effective policy');
    focus.setDisabled(disabled.get());
  };
  def.context.subscribe(FORM_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  def.event.on('press.commit', (run) => {
    if (!disabled.get()) formMethod(run, 'requestReset');
  });
  return (r: RendererHandle<any>) => r.slot();
}
export const asFormReset = defineAsHook<FormActionProps>({ name: 'as-form-reset', setup });
export default definePrototype({ name: 'base-form-reset', setup });
