import type { InputOtpSeparatorExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpSeparator } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<{}, InputOtpSeparatorExposes>({
  name: 'bootstrap-2-3-2-input-otp-separator',
  setup(def) {
    const inherited = asInputOtpSeparator();
    def.feedback.style.use(tw('px-[5px] text-[14px] leading-[20px] text-[#555]'));
    return inherited.render;
  },
});
