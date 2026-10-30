import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogCancel,
  type AlertDialogCancelProps,
  type AlertDialogCancelExposes,
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
export default definePrototype<AlertDialogCancelProps, AlertDialogCancelExposes>({
  name: 'bootstrap-2-3-2-alert-dialog-cancel',
  modules: asAlertDialogCancel.modules,
  setup(def) {
    const behavior = asAlertDialogCancel();
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
    return behavior.render;
  },
});
