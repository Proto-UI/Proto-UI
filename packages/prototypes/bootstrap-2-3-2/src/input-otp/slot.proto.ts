import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpSlot } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype({
  name: 'bootstrap-2-3-2-input-otp-slot',
  setup(def) {
    const inherited = asInputOtpSlot();
    def.feedback.style.use(
      tw(
        'inline-flex size-8 items-center justify-center rounded-[4px] border border-border bg-background text-lg font-medium tabular-nums text-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.active).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring')),
    });
    return inherited.render;
  },
});
