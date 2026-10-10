import type { InputOtpInputExposes } from '@proto.ui/prototypes-base/input-otp';
import type { InputOtpInputProps } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpInput } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<InputOtpInputProps, InputOtpInputExposes>({
  name: 'shadcn-input-otp-input',
  modules: asInputOtpInput.modules,
  setup(def) {
    const inherited = asInputOtpInput();
    def.feedback.style.use(
      tw(
        'block min-h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-base tabular-nums text-foreground outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    return inherited.render;
  },
});
