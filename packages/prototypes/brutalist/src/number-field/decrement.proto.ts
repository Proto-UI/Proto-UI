import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldDecrement } from '@proto.ui/prototypes-base/number-field';
import { BRUTALIST_FOCUS_TOKENS } from '../style';
export default definePrototype<NumberFieldPartProps, NumberFieldStepExposes>({
  name: 'brutalist-number-field-decrement',
  modules: asNumberFieldDecrement.modules,
  setup(def) {
    const inherited = asNumberFieldDecrement();
    const state = inherited.stateHandles!;
    const hovered = def.state.bool('stepPointerHovered', false);
    const pressed = def.state.bool('stepPointerPressed', false);
    const clearHovered = () => hovered.set(false, 'reason: step pointer hover ended');
    const clearPressed = () => pressed.set(false, 'reason: step pointer press ended');
    def.event.on('pointer.enter', () => {
      if (!state.disabled.get()) hovered.set(true, 'reason: step pointer enter');
    });
    def.event.on('pointer.leave', () => {
      clearHovered();
      clearPressed();
    });
    def.event.on('pointer.cancel', () => {
      clearHovered();
      clearPressed();
    });
    def.event.on('pointer.down', () => {
      if (!state.disabled.get()) pressed.set(true, 'reason: step pointer down');
    });
    def.event.on('pointer.up', clearPressed);
    def.lifecycle.onUnmounted(() => {
      clearHovered();
      clearPressed();
    });
    if ('watch' in state.disabled) {
      state.disabled.watch((_run, event) => {
        if (event.type === 'next' && event.next) {
          clearHovered();
          clearPressed();
        }
      });
    }
    def.feedback.style.use(
      tw(
        'inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-base border-2 border-border bg-secondary-background shadow-[2px_2px_0_0_var(--pui-border)] p-2 font-sans text-sm font-medium text-foreground select-none cursor-pointer outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(hovered).eq(true),
          w.state(pressed).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.disabled).eq(false), w.state(pressed).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-main/80 text-main-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS, 'forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed shadow-none')),
    });
    return inherited.render;
  },
});
