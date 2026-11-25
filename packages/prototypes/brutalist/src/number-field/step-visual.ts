import { tw, type DefHandle, type State } from '@proto.ui/core';
import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { BRUTALIST_FOCUS_TOKENS } from '../style';

/** Paint only; the inherited Number Field owns activation and effective availability. */
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

  def.feedback.style.use(
    tw(
      'inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-base border-2 border-border bg-secondary-background shadow-[2px_2px_0_0_var(--pui-border)] p-2 font-sans text-sm font-medium text-foreground select-none cursor-pointer outline-none'
    )
  );
  def.rule({
    when: (w) => w.all(w.state(state.disabled).eq(false), w.state(hovered).eq(true)),
    intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
  });
  def.rule({
    when: (w) => w.all(w.state(state.disabled).eq(false), w.state(pressed).eq(true)),
    intent: (i) => i.feedback.style.use(tw('bg-main/80')),
  });
  def.rule({
    when: (w) => w.state(state.focusVisible).eq(true),
    intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS, 'forced-colors-focus-outline')),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed shadow-none')),
  });
}
