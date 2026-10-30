import type { InputOtpInputExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpInput } from '@proto.ui/prototypes-base/input-otp';
import { setupInputVisual } from '../input/visual';
import type { ShadcnInputOtpInputProps } from './types';

/** Visible Base OTP editor borrowing pinned Input paint, not input-otp's hidden-input DOM. */
export default definePrototype<ShadcnInputOtpInputProps, InputOtpInputExposes>({
  name: 'shadcn-input-otp-input',
  modules: asInputOtpInput.modules,
  setup(def) {
    const inherited = asInputOtpInput();
    setupInputVisual(def, inherited.stateHandles!, undefined, true);
    def.feedback.style.use(tw('block flex-1 tabular-nums'));
    return inherited.render;
  },
});
