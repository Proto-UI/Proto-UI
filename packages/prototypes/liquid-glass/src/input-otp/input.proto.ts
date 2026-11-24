import type { InputOtpInputExposes, InputOtpInputProps } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpInput } from '@proto.ui/prototypes-base/input-otp';
import { COMMAND_BLOCKED, COMMAND_FOCUS, COMMAND_FOCUSED_ELEVATION } from '../interactive-surface';
import { LIQUID_GLASS_INPUT_OTP_VISUAL } from './visual';

export default definePrototype<InputOtpInputProps, InputOtpInputExposes>({
  name: 'liquid-glass-input-otp-input',
  modules: asInputOtpInput.modules,
  setup(def) {
    const inherited = asInputOtpInput();
    const invalid = def.state.bool('liquidGlassOtpInputInvalid', false);
    const syncInvalid = (run: RunHandle<InputOtpInputProps>) => {
      const next = Boolean(
        run.context.tryRead(LIQUID_GLASS_INPUT_OTP_VISUAL)?.invalid ||
        run.context.tryRead(FIELD_CONTEXT)?.invalid
      );
      if (invalid.get() !== next) invalid.set(next, 'reason: Liquid Glass OTP input invalid');
    };
    def.context.trySubscribe(LIQUID_GLASS_INPUT_OTP_VISUAL, syncInvalid);
    def.context.trySubscribe(FIELD_CONTEXT, syncInvalid);
    def.lifecycle.onCreated(syncInvalid);
    def.lifecycle.onMounted(syncInvalid);
    def.feedback.style.use(
      tw(
        'block min-h-11 min-w-0 flex-1 rounded-2xl border border-border bg-secondary px-4 py-2 font-sans text-base tabular-nums text-foreground placeholder:text-muted-foreground shadow-xs ring-1 ring-inset ring-foreground/10 outline-none transition-[color,box-shadow] duration-200'
      )
    );
    def.rule({
      when: (w) =>
        w.all(w.state(inherited.stateHandles!.focusVisible).eq(true), w.state(invalid).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw(`${COMMAND_FOCUS} ${COMMAND_FOCUSED_ELEVATION} bg-background`)),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(invalid).eq(true), w.state(inherited.stateHandles!.focusVisible).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw('border-destructive ring-1 ring-inset ring-destructive/20')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(invalid).eq(true), w.state(inherited.stateHandles!.focusVisible).eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            `border-destructive bg-background outline-none forced-colors-focus-outline ring-2 ring-destructive ring-offset-2 ring-offset-background ${COMMAND_FOCUSED_ELEVATION}`
          )
        ),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`bg-muted text-muted-foreground ${COMMAND_BLOCKED}`)),
    });
    def.rule({
      when: (w) => w.meta('reducedMotion').eq(true),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return inherited.render;
  },
});
