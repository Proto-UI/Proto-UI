import type { InputOtpInputProps } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpControl } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<InputOtpInputProps, Record<string, unknown>>({
  name: 'bootstrap-2-3-2-input-otp-control',
  modules: asInputOtpControl.modules,
  setup(def) {
    const inherited = asInputOtpControl();
    def.feedback.style.use(
      tw(
        'block min-h-8 min-w-0 flex-1 rounded-[4px] border border-border bg-background px-3 py-2 text-base tabular-nums text-foreground outline-none'
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
