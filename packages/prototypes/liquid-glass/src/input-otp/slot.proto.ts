import type { InputOtpSlotExposes } from '@proto.ui/prototypes-base/input-otp';
import type { InputOtpSlotProps } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpSlot } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<InputOtpSlotProps, InputOtpSlotExposes>({
  name: 'liquid-glass-input-otp-slot',
  setup(def) {
    const inherited = asInputOtpSlot();
    def.feedback.style.use(
      tw(
        'inline-flex size-11 items-center justify-center rounded-2xl border border-border bg-background text-lg font-medium tabular-nums text-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.active).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring')),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.feedback.material.use({ intent: 'liquid-glass' });
    return inherited.render;
  },
});
