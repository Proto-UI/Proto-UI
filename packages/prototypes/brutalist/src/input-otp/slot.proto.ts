import type { InputOtpSlotExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpSlot, INPUT_OTP_CONTEXT } from '@proto.ui/prototypes-base/input-otp';
import { BRUTALIST_INPUT_OTP_VISUAL, type BrutalistInputOtpSlotProps } from './visual';

export default definePrototype<BrutalistInputOtpSlotProps, InputOtpSlotExposes>({
  name: 'brutalist-input-otp-slot',
  modules: asInputOtpSlot.modules,
  setup(def) {
    const inherited = asInputOtpSlot();
    def.props.define({
      invalid: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ invalid: false });
    const invalid = def.state.bool('brutalistOtpSlotInvalid', false);
    const disabled = def.state.bool('brutalistOtpSlotDisabled', false);
    const syncVisual = (run: RunHandle<BrutalistInputOtpSlotProps>) => {
      const visual = run.context.tryRead(BRUTALIST_INPUT_OTP_VISUAL);
      const otp = run.context.tryRead(INPUT_OTP_CONTEXT);
      const field = run.context.tryRead(FIELD_CONTEXT);
      invalid.set(
        Boolean(run.props.get().invalid || visual?.invalid || field?.invalid),
        'reason: Brutalist OTP slot invalid'
      );
      disabled.set(
        Boolean(otp?.disabled || visual?.disabled),
        'reason: Brutalist OTP slot disabled'
      );
    };
    def.context.trySubscribe(BRUTALIST_INPUT_OTP_VISUAL, syncVisual);
    def.context.trySubscribe(INPUT_OTP_CONTEXT, syncVisual);
    def.context.trySubscribe(FIELD_CONTEXT, syncVisual);
    def.props.watch(['invalid'], syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.lifecycle.onUpdated(syncVisual);
    def.feedback.style.use(
      tw(
        'relative inline-flex size-10 shrink-0 items-center justify-center rounded-base border-2 border-border bg-secondary-background shadow-[2px_2px_0_0_var(--pui-border)] font-sans text-sm leading-5 font-medium tabular-nums text-foreground outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(w.state(inherited.stateHandles!.active).eq(true), w.state(invalid).eq(false)),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'z-10 bg-main text-main-foreground ring-2 ring-ring ring-offset-2 ring-offset-background'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(invalid).eq(true), w.state(inherited.stateHandles!.active).eq(false)),
      intent: (i) => i.feedback.style.use(tw('border-destructive text-destructive-ink')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(invalid).eq(true), w.state(inherited.stateHandles!.active).eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'z-10 border-destructive bg-destructive text-destructive-foreground ring-2 ring-destructive ring-offset-2 ring-offset-background'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed shadow-none')),
    });
    return inherited.render;
  },
});
