import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogTrigger,
  type DialogTriggerProps,
  type DialogTriggerExposes,
} from '@proto.ui/prototypes-base/dialog';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';

// Passive family Button paint; the inherited Dialog command keeps sole open-request ownership.
// Upstream .modal callers are plain .btn controls (twbs/bootstrap@b4c4072 less/modals.less,
// less/buttons.less), so the default .btn raised/fill recipe applies here.
export default definePrototype<DialogTriggerProps, DialogTriggerExposes>({
  name: 'bootstrap-2-3-2-dialog-trigger',
  setup(def) {
    const behavior = asDialogTrigger();
    const state = behavior.getState!;
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-[12px] py-[4px] text-[14px] font-normal leading-[20px] select-none cursor-pointer min-w-0 max-w-full whitespace-normal wrap-anywhere text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.rule({
      when: (w) =>
        w.all(
          w.state(state('disabled')!).eq(false),
          w.state(state('pressed')!).eq(false),
          w.state(state('hovered')!).eq(false),
          w.not(w.state(state('focused')!).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state('disabled')!).eq(false),
          w.state(state('pressed')!).eq(false),
          w.any(w.state(state('hovered')!).eq(true), w.state(state('focused')!).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.default)),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.state(state('disabled')!).eq(true),
          w.all(
            w.state(state('pressed')!).eq(true),
            w.state(state('hovered')!).eq(false),
            w.not(w.state(state('focused')!).eq(true))
          )
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonFlatFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state('disabled')!).eq(false),
          w.state(state('pressed')!).eq(true),
          w.any(w.state(state('hovered')!).eq(true), w.state(state('focused')!).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state('pressed')!).eq(true), w.state(state('disabled')!).eq(false)),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('opacity-65 pointer-events-none cursor-default shadow-none')),
    });
  },
});
