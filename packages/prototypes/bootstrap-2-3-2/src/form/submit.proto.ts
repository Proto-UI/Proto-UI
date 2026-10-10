import { definePrototype, tw } from '@proto.ui/core';
import {
  asFormSubmit,
  type FormActionExposes,
  type FormActionProps,
} from '@proto.ui/prototypes-base/form';
import {
  bootstrapButtonFill,
  bootstrapButtonActiveFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';
// Passive bootstrap-2-3-2 Button paint; Base Form remains the sole action owner.
// Keep rules in the owning setup so source lowering can resolve the actual borrowed states.
export default definePrototype<FormActionProps, FormActionExposes>({
  name: 'bootstrap-2-3-2-form-submit',
  setup(def) {
    const inherited = asFormSubmit();
    const state = inherited.stateHandles!;
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-3 py-1 text-sm font-normal leading-5 whitespace-nowrap select-none cursor-pointer'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.feedback.style.use(tw(bootstrapButtonFill['primary']));
    def.rule({
      when: (w) => w.state(state.hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonActiveFill['primary'])),
    });
    def.rule({
      when: (w) => w.state(state.pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonActiveFill['primary'])),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonActiveFill['primary'])),
    });
    def.rule({
      when: (w) => w.state(state.pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('opacity-65 pointer-events-none cursor-default shadow-none')),
    });
    return inherited.render;
  },
});
