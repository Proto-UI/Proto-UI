import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerTrigger,
  type DrawerTriggerProps,
  type DrawerTriggerExposes,
} from '@proto.ui/prototypes-base/drawer';
import {
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
  BRUTALIST_PRESS_TOKENS,
  BRUTALIST_STRUCTURE_TOKENS,
} from '../style';

export default definePrototype<DrawerTriggerProps, DrawerTriggerExposes>({
  name: 'brutalist-drawer-trigger',
  setup(def) {
    const behavior = asDrawerTrigger();
    const state = behavior.getState!;
    const pressed = state('pressed')!;
    const focusVisible = state('focusVisible')!;
    const disabled = state('disabled')!;

    def.feedback.style.use(
      tw(
        `${BRUTALIST_STRUCTURE_TOKENS} inline-flex items-center justify-center bg-primary text-primary-foreground min-h-10 px-4 py-2 text-sm min-w-0 max-w-full whitespace-normal wrap-anywhere text-center select-none cursor-pointer outline-none`
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
