import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpSeparator } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<{}, Record<string, unknown>>({
  name: 'liquid-glass-input-otp-separator',
  setup(def) {
    const inherited = asInputOtpSeparator();
    def.feedback.style.use(tw('px-1 text-muted-foreground'));
    return inherited.render;
  },
});
