import type { InputOtpInputExposes, InputOtpInputProps } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpInput } from '@proto.ui/prototypes-base/input-otp';
import { bootstrapLightControlInvalidPaint, setupInputVisual } from '../input/visual';
import { BOOTSTRAP_INPUT_OTP_VISUAL } from './visual';

export default definePrototype<InputOtpInputProps, InputOtpInputExposes>({
  name: 'bootstrap-2-3-2-input-otp-input',
  modules: asInputOtpInput.modules,
  setup(def) {
    const inherited = asInputOtpInput();
    const invalid = def.state.bool('bootstrapOtpInputInvalid', false);
    const syncInvalid = (run: RunHandle<InputOtpInputProps>) => {
      const next = Boolean(
        run.context.tryRead(BOOTSTRAP_INPUT_OTP_VISUAL)?.invalid ||
        run.context.tryRead(FIELD_CONTEXT)?.invalid
      );
      if (invalid.get() !== next) invalid.set(next, 'reason: Bootstrap OTP input invalid');
    };
    def.context.trySubscribe(BOOTSTRAP_INPUT_OTP_VISUAL, syncInvalid);
    def.context.trySubscribe(FIELD_CONTEXT, syncInvalid);
    def.lifecycle.onCreated(syncInvalid);
    def.lifecycle.onMounted(syncInvalid);
    setupInputVisual(def, inherited.stateHandles!, invalid);
    def.feedback.style.use(tw('m-0 tabular-nums'));
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapLightControlInvalidPaint)),
    });
    def.rule({
      when: (w) => w.meta('reducedMotion').eq(true),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return inherited.render;
  },
});
