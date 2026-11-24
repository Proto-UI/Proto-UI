import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastClose,
  type ToastCloseProps,
  type ToastCloseExposes,
} from '@proto.ui/prototypes-base/toast';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';

export default definePrototype<ToastCloseProps, ToastCloseExposes>({
  name: 'brutalist-toast-close',
  modules: asToastClose.modules,
  setup(def) {
    const behavior = asToastClose();
    def.feedback.style.use(
      tw(
        'rounded-base border-2 border-black bg-secondary-background text-foreground shadow-[4px_4px_0_0_#000] font-sans font-bold text-xs leading-4 inline-flex min-w-0 shrink-0 items-center justify-center h-8 px-3 whitespace-nowrap select-none cursor-pointer outline-none active:translate-x-1 active:translate-y-1 active:shadow-none'
      )
    );
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
