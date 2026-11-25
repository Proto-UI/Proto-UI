import { tw, type DefHandle, type State } from '@proto.ui/core';
import { setupButtonVisual } from '../button/visual';

/** Passive step-button paint; Base Number Field retains activation and availability. */
export function setupNumberFieldStepVisual<Props extends object, Exposes>(
  def: DefHandle<Props, Exposes>,
  state: { disabled: State<boolean>; focusVisible: State<boolean> }
): void {
  const hovered = def.state.bool('bootstrapNumberStepHovered', false);
  const pressed = def.state.bool('bootstrapNumberStepPressed', false);
  const clear = () => {
    hovered.set(false, 'reason: Bootstrap number step interaction reset');
    pressed.set(false, 'reason: Bootstrap number step interaction reset');
  };
  def.event.on('pointer.enter', () => {
    if (!state.disabled.get()) hovered.set(true, 'reason: Bootstrap number step hover');
  });
  def.event.on('pointer.down', () => {
    if (!state.disabled.get()) pressed.set(true, 'reason: Bootstrap number step active');
  });
  def.event.on('pointer.up', () => {
    pressed.set(false, 'reason: Bootstrap number step pointer released');
  });
  def.event.on('pointer.leave', clear);
  def.event.on('pointer.cancel', clear);
  def.event.on('press.cancel', clear);
  def.event.on('press.commit', () => {
    pressed.set(false, 'reason: Bootstrap number step activation finished');
  });
  state.disabled.watch((_run, event) => {
    if (event.type === 'next' && event.next) clear();
  });
  def.lifecycle.onUnmounted(clear);

  setupButtonVisual(def, state);
  def.feedback.style.use(tw('h-[30px] min-w-[30px] px-[10px] py-[4px]'));
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.disabled).eq(false),
        w.state(hovered).eq(true),
        w.state(pressed).eq(false)
      ),
    intent: (i) =>
      i.feedback.style.use(tw('bg-[#e6e6e6_linear-gradient(#fff,#e6e6e6)_0_-15px_repeat-x]')),
  });
  def.rule({
    when: (w) => w.all(w.state(state.disabled).eq(false), w.state(pressed).eq(true)),
    intent: (i) =>
      i.feedback.style.use(
        tw(
          'bg-[#e6e6e6_none_0_-15px_repeat-x] shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]'
        )
      ),
  });
}
