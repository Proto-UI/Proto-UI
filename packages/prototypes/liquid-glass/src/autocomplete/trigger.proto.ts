import { definePrototype, tw } from '@proto.ui/core';
import {
  COMMAND_DISABLED,
  COMMAND_FOCUS,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';
import {
  asAutocompleteTrigger,
  type AutocompleteTriggerProps,
  type AutocompleteTriggerExposes,
} from '@proto.ui/prototypes-base/autocomplete';

export type LiquidGlassAutocompleteTriggerProps = AutocompleteTriggerProps & {
  variant?: 'regular' | 'prominent';
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassAutocompleteTriggerProps, AutocompleteTriggerExposes>({
  name: 'liquid-glass-autocomplete-trigger',
  modules: asAutocompleteTrigger.modules,
  setup(def) {
    const behavior = asAutocompleteTrigger();
    const disabled = behavior.getState!('disabled')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const hovered = def.state.bool('hovered', false);
    const pressed = def.state.bool('pressed', false);

    def.props.define({
      variant: { type: 'enum', empty: 'fallback', options: ['regular', 'prominent'] },
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
    });
    def.props.setDefaults({ variant: 'regular', material: 'auto' });

    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const isPressed of [false, true]) {
      def.rule({
        when: (w) =>
          w.all(
            w.prop('material').eq('auto'),
            w.state(pressed).eq(isPressed),
            w.state(disabled).eq(false)
          ),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            deformation: {
              kind: 'press',
              phase: isPressed ? 'pressed' : 'rest',
              contact: 'pointer',
            },
          }),
      });
    }

    def.event.on('pointer.enter', () => {
      if (disabled.get()) return;
      hovered.set(true, 'reason: liquid-glass autocomplete trigger pointer.enter');
    });
    def.event.on('pointer.leave', () => {
      hovered.set(false, 'reason: liquid-glass autocomplete trigger pointer.leave');
      pressed.set(false, 'reason: liquid-glass autocomplete trigger pointer.leave');
    });
    def.event.on('pointer.cancel', () => {
      hovered.set(false, 'reason: liquid-glass autocomplete trigger pointer.cancel');
      pressed.set(false, 'reason: liquid-glass autocomplete trigger pointer.cancel');
    });
    def.event.on('press.cancel', () => {
      hovered.set(false, 'reason: liquid-glass autocomplete trigger press.cancel');
      pressed.set(false, 'reason: liquid-glass autocomplete trigger press.cancel');
    });
    def.event.on('pointer.down', () => {
      if (disabled.get()) return;
      pressed.set(true, 'reason: liquid-glass autocomplete trigger pointer.down');
    });
    def.event.on('pointer.up', () => {
      pressed.set(false, 'reason: liquid-glass autocomplete trigger pointer.up');
    });
    def.event.on('press.commit', () => {
      pressed.set(false, 'reason: liquid-glass autocomplete trigger press.commit');
    });
    def.lifecycle.onUnmounted(() => {
      hovered.set(false, 'reason: liquid-glass autocomplete trigger unmounted');
      pressed.set(false, 'reason: liquid-glass autocomplete trigger unmounted');
    });

    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium whitespace-nowrap select-none cursor-pointer outline-none shadow-sm'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('no-preference'),
      intent: (i) => i.feedback.style.use(tw('transition-shadow')),
    });
    def.rule({
      when: (w) => w.not(w.meta('preference.reducedMotion').eq('no-preference')),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('regular'),
      intent: (i) => i.feedback.style.use(tw('bg-secondary text-secondary-foreground')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('prominent'),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground border-primary')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(hovered).eq(true),
          w.state(pressed).eq(false),
          w.state(disabled).eq(false),
          w.state(focusVisible).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
    });
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED, 'bg-muted text-muted-foreground')),
    });

    return (renderer) => [
      renderer.r.slot(),
      renderer.el(
        'span',
        { style: tw('pointer-events-none flex size-4 shrink-0 items-center justify-center') },
        renderer.svg.root(
          {
            viewBox: '0 0 24 24',
            'aria-hidden': 'true',
            width: 14,
            height: 14,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          renderer.svg.path({ d: 'm6 9 6 6 6-6' })
        )
      ),
    ];
  },
});
