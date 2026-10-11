import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible, asFocusRoving } from '@proto.ui/hooks';
import type {
  ToastViewportProps,
  ToastViewportExposes,
  ToastViewportAsHookContract,
} from './types';
function setup(def: DefHandle<ToastViewportProps, ToastViewportExposes>) {
  def.props.define({
    a11yLabel: { type: 'string', empty: 'fallback' },
    hotkey: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ a11yLabel: 'Notifications', hotkey: 'F8' });
  const label = def.state.string('label', 'Notifications');
  const a11y = asAccessible();
  a11y.role('region');
  a11y.name(label);
  const focus = asFocusRoving<ToastViewportProps>();
  focus.configure({ navigation: 'none', loop: false, entry: 'first' });
  def.expose.method('focusFirst', () => focus.focusFirst());
  const sync = (run: any) =>
    label.set(run.props.get().a11yLabel ?? 'Notifications', 'reason: toast viewport name');
  def.lifecycle.onCreated(sync);
  def.props.watch(['a11yLabel'], sync);
  def.event.onGlobal('key.down', (run, event) => {
    if (event.key !== run.props.get().hotkey) return;
    event.control.requestDefaultActionPrevention({
      reason: 'toast.focus-hotkey',
      source: 'base-toast-viewport',
    });
    focus.focusFirst();
  });
}
export const asToastViewport = defineAsHook<
  ToastViewportProps,
  ToastViewportExposes,
  ToastViewportAsHookContract
>({ name: 'as-toast-viewport', setup });
export default definePrototype({ name: 'base-toast-viewport', setup });
