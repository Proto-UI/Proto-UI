import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverClose,
  type PopoverCloseProps,
  type PopoverCloseExposes,
} from '@proto.ui/prototypes-base/popover';
import {
  BRUTALIST_CONTROL_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_PRESS_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
  BRUTALIST_DISABLED_TOKENS,
} from '../style';

export default definePrototype<PopoverCloseProps, PopoverCloseExposes>({
  name: 'brutalist-popover-close',
  modules: asPopoverClose.modules,
  setup(def) {
    const behavior = asPopoverClose();
    def.feedback.style.use(
      tw(
        BRUTALIST_CONTROL_TOKENS,
        'inline-flex items-center justify-center px-3 py-2 text-sm cursor-pointer outline-none transition-none'
      )
    );
    const state = behavior.getState!;
    def.rule({
      when: (w) => w.all(w.state(state('pressed')!).eq(true), w.state(state('disabled')!).eq(false)),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_PRESS_TOKENS, BRUTALIST_MOTION_HIT_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS, 'cursor-not-allowed')),
    });
    return behavior.render;
  },
});
