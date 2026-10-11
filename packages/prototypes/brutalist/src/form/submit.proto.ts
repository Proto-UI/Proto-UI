import { definePrototype, tw } from '@proto.ui/core';
import {
  asFormSubmit,
  type FormActionExposes,
  type FormActionProps,
} from '@proto.ui/prototypes-base/form';
import {
  BRUTALIST_STRUCTURE_TOKENS,
  BRUTALIST_HOVER_LIFT_TOKENS,
  BRUTALIST_PRESS_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_DISABLED_TOKENS,
} from '../style';
// Passive brutalist Button paint; Base Form remains the sole action owner.
// Keep rules in the owning setup so source lowering can resolve the actual borrowed states.
export default definePrototype<FormActionProps, FormActionExposes>({
  name: 'brutalist-form-submit',
  setup(def) {
    const inherited = asFormSubmit();
    const state = inherited.stateHandles!;
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap select-none font-sans font-medium h-10 px-4 text-sm'
      )
    );
    def.feedback.style.use(tw(BRUTALIST_STRUCTURE_TOKENS));
    def.feedback.style.use(tw('bg-main text-main-foreground'));
    def.rule({
      when: (w) => w.state(state.hovered).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_HOVER_LIFT_TOKENS} ${BRUTALIST_MOTION_HIT_TOKENS}`)),
    });
    def.rule({
      when: (w) => w.state(state.pressed).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_PRESS_TOKENS} ${BRUTALIST_MOTION_HIT_TOKENS}`)),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
    return inherited.render;
  },
});
