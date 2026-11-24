import type { InputOtpRootExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpRoot } from '@proto.ui/prototypes-base/input-otp';
import { BOOTSTRAP_INPUT_OTP_VISUAL, type BootstrapInputOtpRootProps } from './visual';

export default definePrototype<BootstrapInputOtpRootProps, InputOtpRootExposes>({
  name: 'bootstrap-2-3-2-input-otp-root',
  modules: asInputOtpRoot.modules,
  setup(def) {
    const inherited = asInputOtpRoot();
    def.props.define({
      invalid: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ invalid: false });
    // OTP is a Proto extension using the historical text-control vocabulary.
    def.feedback.style.use(
      tw(
        'flex min-w-0 flex-wrap items-center gap-[5px] font-sans text-foreground text-[14px] leading-[20px]'
      )
    );
    def.context.provide(BOOTSTRAP_INPUT_OTP_VISUAL, { disabled: false, invalid: false });
    const syncVisual = (run: RunHandle<BootstrapInputOtpRootProps>) => {
      const p = run.props.get();
      const field = run.context.tryRead(FIELD_CONTEXT);
      const disabled = Boolean(
        p.disabled || field?.disabled || inherited.stateHandles!.disabled.get()
      );
      const invalid = Boolean(p.invalid || field?.invalid);
      const prev = run.context.read(BOOTSTRAP_INPUT_OTP_VISUAL);
      if (prev.disabled !== disabled || prev.invalid !== invalid) {
        run.context.update(BOOTSTRAP_INPUT_OTP_VISUAL, { disabled, invalid });
      }
    };
    def.context.subscribe(BOOTSTRAP_INPUT_OTP_VISUAL);
    def.context.trySubscribe(FIELD_CONTEXT, syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.props.watch(['disabled', 'invalid'], syncVisual);
    return inherited.render;
  },
});
