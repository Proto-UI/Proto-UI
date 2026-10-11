import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTrigger } from '@proto.ui/hooks';
import { TOAST_FAMILY, dismissToast, createToastId } from './shared';
import type { ToastCloseProps, ToastCloseExposes, ToastCloseAsHookContract } from './types';
function setup(def: DefHandle<ToastCloseProps, ToastCloseExposes>) {
  const focusId = createToastId();
  def.anatomy.claim(TOAST_FAMILY, { role: 'close' });
  asTrigger();
  def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
  def.props.setDefaults({ disabled: false });
  const disabled = def.state.bool('disabled', false);
  const focus = asFocusable();
  focus.configure({ disabled: false });
  const a11y = asAccessible();
  a11y.role('button');
  a11y.nameFromContent();
  a11y.state('disabled', disabled);
  def.expose.state('disabled', disabled);
  def.expose.state('focused', focus.focused);
  def.expose.state('focusVisible', focus.focusVisible);

  const sync = (run: any) => {
    disabled.set(!!run.props.get().disabled, 'reason: toast command disabled');
    focus.setDisabled(disabled.get());
  };
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  const notifyFocus = (run: any, focused: boolean) => {
    const fn = run.anatomy.partsOf(TOAST_FAMILY, 'root')[0]?.getExpose('__setFocused');
    if (typeof fn === 'function') fn(focusId, focused);
  };
  focus.focused.watch((run, event) => {
    if (event.type === 'next') notifyFocus(run, event.next);
  });
  def.lifecycle.onUnmounted((run) => {
    try {
      notifyFocus(run, false);
    } catch (error) {
      if (
        (error as { code?: string }).code !== 'ANATOMY_CLAIM_INVALID' &&
        (error as { code?: string }).code !== 'CONTEXT_DISCONNECTED'
      )
        throw error;
    }
  });
  def.event.onGlobal('key.down', (_run, event) => {
    if (focus.focused.get() && !disabled.get() && event.key === ' ')
      event.control.requestDefaultActionPrevention({
        reason: 'toast.command-space',
        source: 'base-toast-close',
      });
  });
  def.event.on('press.commit', (run) => {
    if (disabled.get()) return;
    dismissToast(run, 'close');
  });
}
export const asToastClose = defineAsHook<
  ToastCloseProps,
  ToastCloseExposes,
  ToastCloseAsHookContract
>({ name: 'as-toast-close', setup });
export default definePrototype({ name: 'base-toast-close', setup });
