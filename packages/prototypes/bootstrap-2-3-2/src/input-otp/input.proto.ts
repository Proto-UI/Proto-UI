import type { InputOtpInputExposes } from '@proto.ui/prototypes-base/input-otp';
import type { InputOtpInputProps } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpInput } from '@proto.ui/prototypes-base/input-otp';
import { setupInputVisual } from '../input/visual';
export default definePrototype<InputOtpInputProps, InputOtpInputExposes>({
  name: 'bootstrap-2-3-2-input-otp-input',
  modules: asInputOtpInput.modules,
  setup(def) {
    const inherited = asInputOtpInput();
    setupInputVisual(def, inherited.stateHandles!);
    def.feedback.style.use(tw('tabular-nums'));
    return inherited.render;
  },
});
