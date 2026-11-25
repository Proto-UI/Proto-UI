import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastAction,
  type ToastActionProps,
  type ToastActionExposes,
} from '@proto.ui/prototypes-base/toast';
import { setupToastHover } from './visual';

export default definePrototype<ToastActionProps, ToastActionExposes>({
  name: 'bootstrap-2-3-2-toast-action',
  modules: asToastAction.modules,
  setup(def) {
    const behavior = asToastAction();
    const state = behavior.stateHandles!;
    const hovered = setupToastHover(def, state.disabled);
    // The Action keeps historical link paint and borrows Base command state.
    def.feedback.style.use(
      tw(
        'inline-block min-w-0 mt-1.5 text-[14px] leading-[20px] font-bold no-underline cursor-pointer outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(hovered).eq(false),
          w.state(state.focused).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('text-[#08c]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('text-[#005580] underline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default pointer-events-none')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    return behavior.render;
  },
});
