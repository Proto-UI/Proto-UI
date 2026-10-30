import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastAction,
  type ToastActionProps,
  type ToastActionExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastActionProps, ToastActionExposes>({
  name: 'bootstrap-2-3-2-toast-action',
  modules: asToastAction.modules,
  setup(def) {
    const behavior = asToastAction();
    const state = behavior.stateHandles!;
    // The Action is a Proto command with historical link paint, not a second
    // Button. Base exposes focus/disabled, but no hovered or pressed fact.
    def.feedback.style.use(
      tw('inline-block min-w-0 text-[14px] leading-[20px] no-underline cursor-pointer')
    );
    def.rule({
      when: (w) => w.all(w.state(state.disabled).eq(false), w.not(w.state(state.focused).eq(true))),
      intent: (i) => i.feedback.style.use(tw('text-[#08c]')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.disabled).eq(false), w.state(state.focused).eq(true)),
      intent: (i) => i.feedback.style.use(tw('text-[#005580] underline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('outline-none ring-2 ring-ring ring-offset-2')),
    });
    return behavior.render;
  },
});
