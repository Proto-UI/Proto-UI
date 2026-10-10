import type { InputOtpSlotProps } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpSlot } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<InputOtpSlotProps, Record<string, unknown>>({
  name: 'shadcn-input-otp-slot',
  setup(def) {
    const inherited = asInputOtpSlot();
    def.feedback.style.use(
      tw(
        'inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-lg font-medium tabular-nums text-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.active).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring')),
    });
    return inherited.render;
  },
});
