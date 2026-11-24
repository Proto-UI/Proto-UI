import type { InputOtpSeparatorExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpSeparator } from '@proto.ui/prototypes-base/input-otp';

export default definePrototype<{}, InputOtpSeparatorExposes>({
  name: 'liquid-glass-input-otp-separator',
  modules: asInputOtpSeparator.modules,
  setup(def) {
    const inherited = asInputOtpSeparator();
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center px-1 font-sans text-muted-foreground select-none'
      )
    );
    return inherited.render;
  },
});
