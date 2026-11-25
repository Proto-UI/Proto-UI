import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastAction,
  type ToastActionProps,
  type ToastActionExposes,
} from '@proto.ui/prototypes-base/toast';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';

export default definePrototype<ToastActionProps, ToastActionExposes>({
  name: 'brutalist-toast-action',
  modules: asToastAction.modules,
  setup(def) {
    const behavior = asToastAction();
    const pressed = def.state.fromInteraction('pressed');
    def.feedback.style.use(
      tw(
        'rounded-base border-2 border-black bg-main text-main-foreground shadow-[4px_4px_0_0_#000] font-sans font-bold text-xs leading-4 inline-flex min-w-0 shrink-0 items-center justify-center h-8 px-3 whitespace-nowrap select-none cursor-pointer outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(w.state(pressed).eq(true), w.state(behavior.getState!('disabled')!).eq(false)),
      intent: (i) => i.feedback.style.use(tw('translate-x-1 translate-y-1 shadow-none')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-not-allowed shadow-none`)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    return behavior.render;
  },
});
