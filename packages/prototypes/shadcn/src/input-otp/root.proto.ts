import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpRoot } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype({
  name: 'shadcn-input-otp-root',
  setup(def) {
    const inherited = asInputOtpRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-3 text-foreground'));
    return inherited.render;
  },
});
