import type { InputOtpSlotExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpSlot, INPUT_OTP_CONTEXT } from '@proto.ui/prototypes-base/input-otp';
import { bootstrapLightControlInvalidPaint } from '../input/visual';
import { BOOTSTRAP_INPUT_OTP_VISUAL, type BootstrapInputOtpSlotProps } from './visual';

export default definePrototype<BootstrapInputOtpSlotProps, InputOtpSlotExposes>({
  name: 'bootstrap-2-3-2-input-otp-slot',
  modules: asInputOtpSlot.modules,
  setup(def) {
    const inherited = asInputOtpSlot();
    def.props.define({
      invalid: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ invalid: false });
    const invalid = def.state.bool('bootstrapOtpSlotInvalid', false);
    const disabled = def.state.bool('bootstrapOtpSlotDisabled', false);
    const syncVisual = (run: RunHandle<BootstrapInputOtpSlotProps>) => {
      const visual = run.context.tryRead(BOOTSTRAP_INPUT_OTP_VISUAL);
      const otp = run.context.tryRead(INPUT_OTP_CONTEXT);
      const field = run.context.tryRead(FIELD_CONTEXT);
      invalid.set(
        Boolean(run.props.get().invalid || visual?.invalid || field?.invalid),
        'reason: Bootstrap OTP slot invalid'
      );
      disabled.set(
        Boolean(otp?.disabled || visual?.disabled),
        'reason: Bootstrap OTP slot disabled'
      );
    };
    def.context.trySubscribe(BOOTSTRAP_INPUT_OTP_VISUAL, syncVisual);
    def.context.trySubscribe(INPUT_OTP_CONTEXT, syncVisual);
    def.context.trySubscribe(FIELD_CONTEXT, syncVisual);
    def.props.watch(['invalid'], syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.lifecycle.onUpdated(syncVisual);
    def.feedback.style.use(
      tw(
        'inline-flex w-[30px] h-[30px] shrink-0 items-center justify-center rounded-[4px] border border-[#ccc] bg-white font-sans text-[14px] leading-[20px] font-normal tabular-nums text-[#555] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)] transition-[border,box-shadow] duration-200 ease-linear'
      )
    );
    def.rule({
      when: (w) =>
        w.all(w.state(inherited.stateHandles!.active).eq(true), w.state(invalid).eq(false)),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'border-[rgb(82_168_236/80%)] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%),0_0_8px_rgb(82_168_236/60%)]'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(invalid).eq(true), w.state(inherited.stateHandles!.active).eq(false)),
      intent: (i) => i.feedback.style.use(tw(bootstrapLightControlInvalidPaint)),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(invalid).eq(true), w.state(inherited.stateHandles!.active).eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            `${bootstrapLightControlInvalidPaint} shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%),0_0_6px_#d59392]`
          )
        ),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-[#eee] cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.meta('reducedMotion').eq(true),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return inherited.render;
  },
});
