import type { InputOtpRootExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpRoot } from '@proto.ui/prototypes-base/input-otp';
import { BRUTALIST_DISABLED_TOKENS } from '../style';
import { BRUTALIST_INPUT_OTP_VISUAL, type BrutalistInputOtpRootProps } from './visual';

export default definePrototype<BrutalistInputOtpRootProps, InputOtpRootExposes>({
  name: 'brutalist-input-otp-root',
  modules: asInputOtpRoot.modules,
  setup(def) {
    const inherited = asInputOtpRoot();
    def.props.define({
      invalid: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ invalid: false });
    def.feedback.style.use(
      tw('flex w-full min-w-0 flex-wrap items-center gap-2 font-sans font-medium text-foreground')
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-not-allowed`)),
    });
    def.context.provide(BRUTALIST_INPUT_OTP_VISUAL, { disabled: false, invalid: false });
    const syncVisual = (run: RunHandle<BrutalistInputOtpRootProps>) => {
      const p = run.props.get();
      const field = run.context.tryRead(FIELD_CONTEXT);
      const disabled = Boolean(
        p.disabled || field?.disabled || inherited.stateHandles!.disabled.get()
      );
      const invalid = Boolean(p.invalid || field?.invalid);
      const prev = run.context.read(BRUTALIST_INPUT_OTP_VISUAL);
      if (prev.disabled !== disabled || prev.invalid !== invalid) {
        run.context.update(BRUTALIST_INPUT_OTP_VISUAL, { disabled, invalid });
      }
    };
    def.context.subscribe(BRUTALIST_INPUT_OTP_VISUAL);
    def.context.trySubscribe(FIELD_CONTEXT, syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.props.watch(['disabled', 'invalid'], syncVisual);
    return inherited.render;
  },
});
