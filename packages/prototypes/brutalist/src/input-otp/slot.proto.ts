import type { InputOtpSlotProps } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpSlot } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<InputOtpSlotProps, Record<string, unknown>>({
  name: 'brutalist-input-otp-slot',
  setup(def) {
    const inherited = asInputOtpSlot();
    def.feedback.style.use(
      tw(
        'inline-flex size-10 items-center justify-center rounded-none border-2 border border-border bg-background shadow-[2px_2px_0_0_var(--pui-border)] text-lg font-bold tabular-nums text-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.active).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring')),
    });
    return inherited.render;
  },
});
