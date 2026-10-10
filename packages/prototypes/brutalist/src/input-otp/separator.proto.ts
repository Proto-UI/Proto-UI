import type { InputOtpSeparatorExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpSeparator } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<{}, InputOtpSeparatorExposes>({
  name: 'brutalist-input-otp-separator',
  setup(def) {
    const inherited = asInputOtpSeparator();
    def.feedback.style.use(tw('px-1 text-muted-foreground'));
    return inherited.render;
  },
});
