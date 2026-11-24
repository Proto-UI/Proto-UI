import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteTrigger,
  type AutocompleteTriggerProps,
  type AutocompleteTriggerExposes,
} from '@proto.ui/prototypes-base/autocomplete';
import {
  BRUTALIST_CONTROL_TOKENS,
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
  BRUTALIST_PRESS_TOKENS,
} from '../style';

export default definePrototype<AutocompleteTriggerProps, AutocompleteTriggerExposes>({
  name: 'brutalist-autocomplete-trigger',
  modules: asAutocompleteTrigger.modules,
  setup(def) {
    const behavior = asAutocompleteTrigger();
    const disabled = behavior.getState!('disabled')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const hovered = def.state.bool('hovered', false);
    const pressed = def.state.bool('pressed', false);

    def.event.on('pointer.enter', () => {
      if (disabled.get()) return;
      hovered.set(true, 'reason: brutalist autocomplete trigger pointer.enter');
    });
    def.event.on('pointer.leave', () => {
      hovered.set(false, 'reason: brutalist autocomplete trigger pointer.leave');
      pressed.set(false, 'reason: brutalist autocomplete trigger pointer.leave');
    });
    def.event.on('pointer.cancel', () => {
      hovered.set(false, 'reason: brutalist autocomplete trigger pointer.cancel');
      pressed.set(false, 'reason: brutalist autocomplete trigger pointer.cancel');
    });
    def.event.on('press.cancel', () => {
      hovered.set(false, 'reason: brutalist autocomplete trigger press.cancel');
      pressed.set(false, 'reason: brutalist autocomplete trigger press.cancel');
    });
    def.event.on('pointer.down', () => {
      if (disabled.get()) return;
      pressed.set(true, 'reason: brutalist autocomplete trigger pointer.down');
    });
    def.event.on('pointer.up', () => {
      pressed.set(false, 'reason: brutalist autocomplete trigger pointer.up');
    });
    def.event.on('press.commit', () => {
      pressed.set(false, 'reason: brutalist autocomplete trigger press.commit');
    });
    def.lifecycle.onUnmounted(() => {
      hovered.set(false, 'reason: brutalist autocomplete trigger unmounted');
      pressed.set(false, 'reason: brutalist autocomplete trigger unmounted');
    });

    def.feedback.style.use(
      tw(
        BRUTALIST_CONTROL_TOKENS,
        'h-10 shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap select-none cursor-pointer outline-none'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('no-preference'),
      intent: (i) => i.feedback.style.use(tw('transition-all')),
    });
    def.rule({
      when: (w) => w.not(w.meta('preference.reducedMotion').eq('no-preference')),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    def.rule({
      when: (w) => w.all(w.state(hovered).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_PRESS_TOKENS, BRUTALIST_MOTION_HIT_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS, 'cursor-not-allowed shadow-none')),
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
