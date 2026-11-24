import type {
  InputOtpControlExposes,
  InputOtpInputProps,
} from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpControl } from '@proto.ui/prototypes-base/input-otp';
import { BRUTALIST_FOCUS_TOKENS } from '../style';

export default definePrototype<InputOtpInputProps, InputOtpControlExposes>({
  name: 'brutalist-input-otp-control',
  modules: asInputOtpControl.modules,
  setup(def) {
    const inherited = asInputOtpControl();
    const binding = inherited.getAsHookHandle?.('as-field-control');
    def.feedback.style.use(
      tw(
        'block min-h-10 min-w-0 flex-1 rounded-base border-2 border-border bg-secondary-background shadow-[2px_2px_0_0_var(--pui-border)] px-3 py-2 font-sans text-sm leading-5 font-medium tabular-nums text-foreground placeholder:text-muted-foreground outline-none'
      )
    );
    def.rule({
      when: (w) =>
        binding
          ? w.all(
              w.state(inherited.stateHandles!.focusVisible).eq(true),
              w.state(binding.state.invalid).eq(false)
            )
          : w.state(inherited.stateHandles!.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
    });
    if (binding) {
      def.rule({
        when: (w) => w.state(binding.state.invalid).eq(true),
        intent: (i) => i.feedback.style.use(tw('border-destructive text-destructive-ink')),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(inherited.stateHandles!.focusVisible).eq(true),
            w.state(binding.state.invalid).eq(true)
          ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              'ring-2 ring-destructive ring-offset-2 ring-offset-background forced-colors-focus-outline'
            )
          ),
      });
    }
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed shadow-none')),
    });
    return inherited.render;
  },
});
