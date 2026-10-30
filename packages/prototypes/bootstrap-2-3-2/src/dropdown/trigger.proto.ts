import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownTrigger,
  type DropdownTriggerProps,
  type DropdownTriggerExposes,
} from '@proto.ui/prototypes-base/dropdown';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';
export default definePrototype<DropdownTriggerProps, DropdownTriggerExposes>({
  name: 'bootstrap-2-3-2-dropdown-trigger',
  modules: asDropdownTrigger.modules,
  setup(def) {
    const behavior = asDropdownTrigger();
    const state = behavior.stateHandles;
    if (!state) throw new Error('Dropdown Trigger capture missing');
    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 items-center justify-center gap-[8px] rounded-[4px] border px-[12px] py-[4px] text-[14px] font-normal leading-[20px] text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)] whitespace-nowrap select-none cursor-pointer'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false),
          w.state(state.hovered).eq(false),
          w.state(state.focused).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false),
          w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(true),
          w.state(state.hovered).eq(false),
          w.state(state.focused).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonFlatFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(true),
          w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill.default)),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-inset')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(`${bootstrapButtonFlatFill.default} opacity-65 cursor-default shadow-none`)
        ),
    });
    return behavior.render;
  },
});
