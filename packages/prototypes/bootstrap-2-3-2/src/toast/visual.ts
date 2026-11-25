import type { DefHandle, State } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export function setupToastHover<Props extends PropsBaseType, Exposes>(
  def: DefHandle<Props, Exposes>,
  disabled: State<boolean>
) {
  const hovered = def.state.bool('toastPointerPaint', false);
  const clear = () => hovered.set(false, 'toast pointer paint reset');
  def.event.on('pointer.enter', () => {
    if (!disabled.get()) hovered.set(true, 'toast pointer paint enter');
  });
  def.event.on('pointer.leave', clear);
  def.event.on('pointer.cancel', clear);
  def.lifecycle.onUnmounted(clear);
  if ('watch' in disabled) {
    disabled.watch((_run, event) => {
      if (event.type === 'next' && event.next) clear();
    });
  }
  return hovered;
}
