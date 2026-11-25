import { tw, type DefHandle, type State } from '@proto.ui/core';
import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { setupButtonVisual } from '../button/visual';

/** Reuse Button paint without installing another activation or focus owner. */
export function setupNumberFieldStepVisual(
  def: DefHandle<NumberFieldPartProps, NumberFieldStepExposes>,
  state: { disabled: State<boolean>; focusVisible: State<boolean> }
) {
  const hovered = def.state.bool('stepPointerHovered', false);
  const pressed = def.state.bool('stepPointerPressed', false);
  const clearPointer = () => {
    hovered.set(false, 'reason: step pointer hover ended');
    pressed.set(false, 'reason: step pointer press ended');
  };
  def.event.on('pointer.enter', () => {
    if (!state.disabled.get()) hovered.set(true, 'reason: step pointer entered');
  });
  def.event.on('pointer.down', () => {
    if (!state.disabled.get()) pressed.set(true, 'reason: step pointer down');
  });
  def.event.on('pointer.up', () => pressed.set(false, 'reason: step pointer up'));
  def.event.on('pointer.leave', clearPointer);
  def.event.on('pointer.cancel', clearPointer);
  def.lifecycle.onUnmounted(clearPointer);
  if ('watch' in state.disabled) {
    state.disabled.watch((_run, event) => {
      if (event.type === 'next' && event.next) clearPointer();
    });
  }

  setupButtonVisual(def, { ...state, hovered, pressed });
  def.feedback.style.use(tw('h-[30px] min-w-[30px] px-[10px] py-[4px]'));
}
