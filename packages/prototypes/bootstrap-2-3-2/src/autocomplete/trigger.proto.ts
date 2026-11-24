import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteTrigger,
  type AutocompleteTriggerProps,
  type AutocompleteTriggerExposes,
} from '@proto.ui/prototypes-base/autocomplete';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';

export default definePrototype<AutocompleteTriggerProps, AutocompleteTriggerExposes>({
  name: 'bootstrap-2-3-2-autocomplete-trigger',
  modules: asAutocompleteTrigger.modules,
  setup(def) {
    const behavior = asAutocompleteTrigger();
    const disabled = behavior.getState!('disabled')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const hovered = def.state.bool('hovered', false);
    const pressed = def.state.bool('pressed', false);

    def.event.on('pointer.enter', () => {
      if (disabled.get()) return;
      hovered.set(true, 'reason: bootstrap autocomplete trigger pointer.enter');
    });
    def.event.on('pointer.leave', () => {
      hovered.set(false, 'reason: bootstrap autocomplete trigger pointer.leave');
      pressed.set(false, 'reason: bootstrap autocomplete trigger pointer.leave');
    });
    def.event.on('pointer.cancel', () => {
      hovered.set(false, 'reason: bootstrap autocomplete trigger pointer.cancel');
      pressed.set(false, 'reason: bootstrap autocomplete trigger pointer.cancel');
    });
    def.event.on('press.cancel', () => {
      hovered.set(false, 'reason: bootstrap autocomplete trigger press.cancel');
      pressed.set(false, 'reason: bootstrap autocomplete trigger press.cancel');
    });
    def.event.on('pointer.down', () => {
      if (disabled.get()) return;
      pressed.set(true, 'reason: bootstrap autocomplete trigger pointer.down');
    });
    def.event.on('pointer.up', () => {
      pressed.set(false, 'reason: bootstrap autocomplete trigger pointer.up');
    });
    def.event.on('press.commit', () => {
      pressed.set(false, 'reason: bootstrap autocomplete trigger press.commit');
    });
    def.lifecycle.onUnmounted(() => {
      hovered.set(false, 'reason: bootstrap autocomplete trigger unmounted');
      pressed.set(false, 'reason: bootstrap autocomplete trigger unmounted');
    });

    def.feedback.style.use(
      tw(
        'h-[30px] box-border inline-flex shrink-0 items-center justify-center gap-[4px] rounded-[4px] border px-[12px] py-[4px] text-[14px] font-normal leading-[20px] text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)] whitespace-nowrap select-none cursor-pointer'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.state(pressed).eq(false),
          w.state(hovered).eq(false),
          w.state(focused).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.state(pressed).eq(false),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.default)),
    });
    def.rule({
      when: (w) => w.all(w.state(disabled).eq(false), w.state(pressed).eq(true)),
      intent: (i) =>
        i.feedback.style.use(tw(bootstrapButtonPressedFill.default, bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            `${bootstrapButtonFlatFill.default} opacity-65 pointer-events-none cursor-default shadow-none`
          )
        ),
    });

    return (renderer) => [
      renderer.r.slot(),
      renderer.el(
        'span',
        { style: tw('pointer-events-none flex size-3.5 shrink-0 items-center justify-center') },
        renderer.svg.root(
          {
            viewBox: '0 0 24 24',
            'aria-hidden': 'true',
            width: 12,
            height: 12,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2.5,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          renderer.svg.path({ d: 'm6 9 6 6 6-6' })
        )
      ),
    ];
  },
});
