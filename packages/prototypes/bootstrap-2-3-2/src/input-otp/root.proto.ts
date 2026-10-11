import type { InputOtpRootProps, InputOtpRootExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpRoot } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<InputOtpRootProps, InputOtpRootExposes>({
  name: 'bootstrap-2-3-2-input-otp-root',
  setup(def) {
    const inherited = asInputOtpRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-2 text-foreground'));
    return inherited.render;
  },
});
