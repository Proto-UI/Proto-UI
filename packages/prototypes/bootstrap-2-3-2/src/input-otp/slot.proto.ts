import type { InputOtpSlotExposes } from '@proto.ui/prototypes-base/input-otp';
import type { InputOtpSlotProps } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpSlot } from '@proto.ui/prototypes-base/input-otp';
export default definePrototype<InputOtpSlotProps, InputOtpSlotExposes>({
  name: 'bootstrap-2-3-2-input-otp-slot',
  setup(def) {
    const inherited = asInputOtpSlot();
    def.feedback.style.use(
      tw(
        'inline-flex w-[30px] h-[30px] items-center justify-center rounded-[4px] border border-[#ccc] bg-white text-[14px] leading-[20px] font-normal tabular-nums text-[#555]'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.active).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring')),
    });
    return inherited.render;
  },
});
