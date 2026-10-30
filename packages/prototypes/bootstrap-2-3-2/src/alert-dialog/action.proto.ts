import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogAction,
  type AlertDialogActionProps,
  type AlertDialogActionExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';

// Passive family Button paint; the inherited AlertDialog command keeps sole action ownership.
export default definePrototype<AlertDialogActionProps, AlertDialogActionExposes>({
  name: 'bootstrap-2-3-2-alert-dialog-action',
  modules: asAlertDialogAction.modules,
  setup(def) {
    const behavior = asAlertDialogAction();
    const state = behavior.getState!;
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-[12px] py-[4px] text-[14px] font-normal leading-[20px] select-none cursor-pointer min-w-0 max-w-full whitespace-normal wrap-anywhere text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)]'
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
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill.primary)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state('disabled')!).eq(false),
          w.state(state('pressed')!).eq(false),
          w.any(w.state(state('hovered')!).eq(true), w.state(state('focused')!).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.primary)),
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
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonFlatFill.primary)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state('disabled')!).eq(false),
          w.state(state('pressed')!).eq(true),
          w.any(w.state(state('hovered')!).eq(true), w.state(state('focused')!).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill.primary)),
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
    return behavior.render;
  },
});
