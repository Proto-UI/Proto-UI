import type { InputOtpRootExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { FIELD_CONTEXT } from '@proto.ui/prototypes-base/field';
import { asInputOtpRoot } from '@proto.ui/prototypes-base/input-otp';
import { setupShadcnStyleSelection } from '../style-scope';
import type { ShadcnInputOtpRootProps } from './types';
import { INPUT_OTP_VISUAL } from './visual';

export default definePrototype<ShadcnInputOtpRootProps, InputOtpRootExposes>({
  name: 'shadcn-input-otp-root',
  modules: asInputOtpRoot.modules,
  setup(def) {
    const inherited = asInputOtpRoot();
    setupShadcnStyleSelection(def, 'nova');
    def.props.define({
      invalid: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ invalid: false });
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-0 text-foreground'));
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
    });
    def.context.provide(INPUT_OTP_VISUAL, { length: 6, disabled: false, invalid: false });
    const syncVisual = (run: RunHandle<ShadcnInputOtpRootProps>) => {
      const p = run.props.get();
      const field = run.context.tryRead(FIELD_CONTEXT);
      const length = p.length ?? 6;
      const disabled = Boolean(
        p.disabled || field?.disabled || inherited.stateHandles!.disabled.get()
      );
      const invalid = Boolean(p.invalid || field?.invalid);
      const prev = run.context.read(INPUT_OTP_VISUAL);
      if (prev.length !== length || prev.disabled !== disabled || prev.invalid !== invalid) {
        run.context.update(INPUT_OTP_VISUAL, { length, disabled, invalid });
      }
    };
    def.context.subscribe(INPUT_OTP_VISUAL);
    def.context.trySubscribe(FIELD_CONTEXT, syncVisual);
    def.lifecycle.onCreated(syncVisual);
    def.lifecycle.onMounted(syncVisual);
    def.props.watch(['length', 'disabled', 'invalid'], syncVisual);
    return inherited.render;
  },
});
