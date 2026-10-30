import type { InputOtpControlExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpControl } from '@proto.ui/prototypes-base/input-otp';
import { setupInputVisual } from '../input/visual';
import type { ShadcnInputOtpInputProps } from './types';

export default definePrototype<ShadcnInputOtpInputProps, InputOtpControlExposes>({
  name: 'shadcn-input-otp-control',
  modules: asInputOtpControl.modules,
  setup(def) {
    const inherited = asInputOtpControl();
    const binding = inherited.getAsHookHandle?.('as-field-control');
    if (!inherited.stateHandles || !binding)
      throw new Error('[shadcn-input-otp-control] Missing Base editor or Field binding.');
    setupInputVisual(def, inherited.stateHandles, binding.state.invalid, true);
    def.feedback.style.use(tw('block flex-1 tabular-nums'));
    return inherited.render;
  },
});
