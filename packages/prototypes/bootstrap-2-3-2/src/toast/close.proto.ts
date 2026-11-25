import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastClose,
  type ToastCloseProps,
  type ToastCloseExposes,
} from '@proto.ui/prototypes-base/toast';
import { setupToastHover } from './visual';

export default definePrototype<ToastCloseProps, ToastCloseExposes>({
  name: 'bootstrap-2-3-2-toast-close',
  modules: asToastClose.modules,
  setup(def) {
    const behavior = asToastClose();
    const state = behavior.stateHandles!;
    const hovered = setupToastHover(def, state.disabled);
    // less/close.less plus .alert .close offsets; authored slots put this
    // command first with '×', as in upstream Bootstrap 2.3.2 alert markup.
    def.feedback.style.use(
      tw(
        'relative top-[-2px] right-[-21px] float-right text-[20px] font-bold leading-[20px] text-paint-[#000_0_1px_0_rgb(255_255_255/100%)] opacity-20 no-underline cursor-pointer outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('opacity-40')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-default pointer-events-none')),
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
