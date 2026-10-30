import type { InputOtpControlExposes } from '@proto.ui/prototypes-base/input-otp';
import type { InputOtpInputProps } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpControl } from '@proto.ui/prototypes-base/input-otp';
import { setupInputVisual } from '../input/visual';
export default definePrototype<InputOtpInputProps, InputOtpControlExposes>({
  name: 'bootstrap-2-3-2-input-otp-control',
  modules: asInputOtpControl.modules,
  setup(def) {
    const inherited = asInputOtpControl();
    const binding = inherited.getAsHookHandle!('as-field-control');
    if (!binding) throw new Error('[bootstrap-2-3-2-input-otp-control] Field binding required.');
    setupInputVisual(
      def,
      { ...inherited.stateHandles!, readOnly: binding.state.fieldReadOnly },
      binding.state.invalid
    );
    def.feedback.style.use(tw('tabular-nums'));
    return inherited.render;
  },
});
