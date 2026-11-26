import { tw, type DefHandle, type State } from '@proto.ui/core';
import type { ToastCloseProps, ToastCloseExposes } from '@proto.ui/prototypes-base/toast';

/** Pointer paint only. Base Toast retains the single activation and dismissal route. */
export function setupToastCommandPress<P extends ToastCloseProps, E extends ToastCloseExposes>(
  def: DefHandle<P, E>,
  disabled: State<boolean>
) {
  const pressed = def.state.bool('toastPointerPressed', false);
  const clear = () => pressed.set(false, 'reason: toast command pointer ended');
  def.event.on('pointer.down', () => {
    if (!disabled.get()) pressed.set(true, 'reason: toast command pointer down');
  });
  def.event.on('pointer.up', clear);
  def.event.on('pointer.leave', clear);
  def.event.on('pointer.cancel', clear);
  def.lifecycle.onUnmounted(clear);
  if ('watch' in disabled) {
    disabled.watch((_run, event) => {
      if (event.type === 'next' && event.next) clear();
    });
  }
  def.rule({
    when: (w) => w.all(w.state(disabled).eq(false), w.state(pressed).eq(true)),
    intent: (i) => i.feedback.style.use(tw('translate-x-1 translate-y-1 shadow-none')),
  });
}
