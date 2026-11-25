import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldIncrement } from '@proto.ui/prototypes-base/number-field';
import { COMMAND_BLOCKED, COMMAND_FOCUS } from '../interactive-surface';
export type LiquidGlassNumberFieldIncrementProps = NumberFieldPartProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassNumberFieldIncrementProps, NumberFieldStepExposes>({
  name: 'liquid-glass-number-field-increment',
  modules: asNumberFieldIncrement.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const inherited = asNumberFieldIncrement();
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
        'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary p-2 font-sans text-secondary-foreground shadow-xs select-none cursor-pointer outline-none transition-shadow'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const phase of [false, true]) {
      def.rule({
        when: (w) =>
          w.all(
            w.prop('material').eq('auto'),
            w.state(state.disabled).eq(false),
            w.state(pressed).eq(phase)
          ),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            variant: 'regular',
            deformation: { kind: 'press', phase: phase ? 'pressed' : 'rest', contact: 'pointer' },
          }),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(hovered).eq(true),
          w.state(pressed).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('shadow-md')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.disabled).eq(false), w.state(pressed).eq(true)),
      intent: (i) => i.feedback.style.use(tw('shadow-xs bg-muted')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED, 'bg-muted text-muted-foreground')),
    });
    return inherited.render;
  },
});
