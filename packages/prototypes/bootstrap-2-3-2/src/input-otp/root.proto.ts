import type { InputOtpRootProps, InputOtpRootExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpRoot } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<InputOtpRootProps, InputOtpRootExposes>({
  name: 'bootstrap-2-3-2-input-otp-root',
  setup(def) {
    const inherited = asInputOtpRoot();
    // OTP is a Proto extension using the historical text-control vocabulary.
    def.feedback.style.use(
      tw('flex min-w-0 flex-wrap items-center gap-[5px] text-foreground text-[14px] leading-[20px]')
    );
    return inherited.render;
  },
});
