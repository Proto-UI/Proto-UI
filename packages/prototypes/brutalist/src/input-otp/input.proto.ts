import type { InputOtpInputExposes, InputOtpInputProps } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpInput } from '@proto.ui/prototypes-base/input-otp';
import { BRUTALIST_FOCUS_TOKENS } from '../style';
import { BRUTALIST_INPUT_OTP_VISUAL } from './visual';

export default definePrototype<InputOtpInputProps, InputOtpInputExposes>({
  name: 'brutalist-input-otp-input',
  modules: asInputOtpInput.modules,
  setup(def) {
    const inherited = asInputOtpInput();
    const invalid = def.state.bool('brutalistOtpInputInvalid', false);
    const syncInvalid = (run: RunHandle<InputOtpInputProps>) => {
      const next = Boolean(
        run.context.tryRead(BRUTALIST_INPUT_OTP_VISUAL)?.invalid ||
        run.context.tryRead(FIELD_CONTEXT)?.invalid
      );
      if (invalid.get() !== next) invalid.set(next, 'reason: Brutalist OTP input invalid');
    };
    def.context.trySubscribe(BRUTALIST_INPUT_OTP_VISUAL, syncInvalid);
    def.context.trySubscribe(FIELD_CONTEXT, syncInvalid);
    def.lifecycle.onCreated(syncInvalid);
    def.lifecycle.onMounted(syncInvalid);
    def.feedback.style.use(
      tw(
        'block min-h-10 min-w-0 flex-1 rounded-base border-2 border-border bg-secondary-background shadow-[2px_2px_0_0_var(--pui-border)] px-3 py-2 font-sans text-sm leading-5 font-medium tabular-nums text-foreground placeholder:text-muted-foreground outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(w.state(inherited.stateHandles!.focusVisible).eq(true), w.state(invalid).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
    });
    def.rule({
      when: (w) => w.state(invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-destructive text-destructive-ink')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(inherited.stateHandles!.focusVisible).eq(true), w.state(invalid).eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'ring-2 ring-destructive ring-offset-2 ring-offset-background forced-colors-focus-outline'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed shadow-none')),
    });
    return inherited.render;
  },
});
