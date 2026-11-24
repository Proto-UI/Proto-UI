import type { InputOtpRootExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpRoot } from '@proto.ui/prototypes-base/input-otp';
import { LIQUID_GLASS_INPUT_OTP_VISUAL, type LiquidGlassInputOtpRootProps } from './visual';

// Content-layer OTP container: stays optically neutral so nested inputs/slots
// never stack glass-on-glass inside surrounding Liquid Glass sheets or cards.
export default definePrototype<LiquidGlassInputOtpRootProps, InputOtpRootExposes>({
  name: 'liquid-glass-input-otp-root',
  modules: asInputOtpRoot.modules,
  setup(def) {
    const inherited = asInputOtpRoot();
    def.props.define({
      invalid: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ invalid: false });
    def.feedback.style.use(
      tw('flex w-full min-w-0 flex-wrap items-center gap-3 font-sans text-foreground')
    );
    def.context.provide(LIQUID_GLASS_INPUT_OTP_VISUAL, { disabled: false, invalid: false });
    const syncVisual = (run: RunHandle<LiquidGlassInputOtpRootProps>) => {
      const p = run.props.get();
      const field = run.context.tryRead(FIELD_CONTEXT);
      const disabled = Boolean(
        p.disabled || field?.disabled || inherited.stateHandles!.disabled.get()
      );
      const invalid = Boolean(p.invalid || field?.invalid);
      const prev = run.context.read(LIQUID_GLASS_INPUT_OTP_VISUAL);
      if (prev.disabled !== disabled || prev.invalid !== invalid) {
        run.context.update(LIQUID_GLASS_INPUT_OTP_VISUAL, { disabled, invalid });
      }
    };
    def.context.subscribe(LIQUID_GLASS_INPUT_OTP_VISUAL);
    def.context.trySubscribe(FIELD_CONTEXT, syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.props.watch(['disabled', 'invalid'], syncVisual);
    return inherited.render;
  },
});
