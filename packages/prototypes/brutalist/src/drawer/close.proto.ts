import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerClose,
  type DrawerCloseProps,
  type DrawerCloseExposes,
} from '@proto.ui/prototypes-base/drawer';
import {
  BRUTALIST_CONTROL_TOKENS,
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
  BRUTALIST_PRESS_TOKENS,
} from '../style';

export default definePrototype<DrawerCloseProps, DrawerCloseExposes>({
  name: 'brutalist-drawer-close',
  setup(def) {
    const behavior = asDrawerClose();
    const state = behavior.getState!;
    const pressed = state('pressed')!;
    const focusVisible = state('focusVisible')!;
    const disabled = state('disabled')!;

    def.feedback.style.use(
      tw(
        `${BRUTALIST_CONTROL_TOKENS} inline-flex items-center justify-center min-h-10 px-4 py-2 text-sm min-w-0 max-w-full whitespace-normal wrap-anywhere text-center select-none cursor-pointer outline-none`
      )
    );
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_PRESS_TOKENS} ${BRUTALIST_MOTION_HIT_TOKENS}`)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-not-allowed`)),
    });
    return behavior.render;
  },
});
