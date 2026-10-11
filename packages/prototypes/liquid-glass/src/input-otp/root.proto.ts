import type { InputOtpRootProps, InputOtpRootExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpRoot } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<InputOtpRootProps, InputOtpRootExposes>({
  name: 'liquid-glass-input-otp-root',
  setup(def) {
    const inherited = asInputOtpRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-3 text-foreground'));
    return inherited.render;
  },
});
