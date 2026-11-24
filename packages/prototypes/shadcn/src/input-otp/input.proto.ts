import type { InputOtpInputExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpInput } from '@proto.ui/prototypes-base/input-otp';
import { setupInputVisual } from '../input/visual';
import type { ShadcnInputOtpInputProps } from './types';
import { INPUT_OTP_VISUAL } from './visual';

/** Visible Base OTP editor borrowing pinned Input paint, not input-otp's hidden-input DOM. */
export default definePrototype<ShadcnInputOtpInputProps, InputOtpInputExposes>({
  name: 'shadcn-input-otp-input',
  modules: asInputOtpInput.modules,
  setup(def) {
    const inherited = asInputOtpInput();
    const invalid = def.state.bool('otpInputVisualInvalid', false);
    const syncInvalid = (run: RunHandle<ShadcnInputOtpInputProps>) => {
      const next = Boolean(
        run.context.tryRead(INPUT_OTP_VISUAL)?.invalid ||
        run.context.tryRead(FIELD_CONTEXT)?.invalid
      );
      if (invalid.get() !== next) invalid.set(next, 'reason: OTP editor visual invalid');
    };
    def.context.trySubscribe(INPUT_OTP_VISUAL, syncInvalid);
    def.context.trySubscribe(FIELD_CONTEXT, syncInvalid);
    def.lifecycle.onCreated(syncInvalid);
    def.lifecycle.onMounted(syncInvalid);
    setupInputVisual(def, inherited.stateHandles!, invalid, true);
    def.feedback.style.use(tw('block flex-1 mr-2 tabular-nums'));
    def.rule({
      when: (w) => w.meta('reducedMotion').eq(true),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return inherited.render;
  },
});
