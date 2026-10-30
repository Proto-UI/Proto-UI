import type { InputOtpRootExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
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
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-2 text-foreground'));
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    def.context.provide(INPUT_OTP_VISUAL, { length: 6 });
    const syncLength = (run: RunHandle<ShadcnInputOtpRootProps>) => {
      const length = run.props.get().length!;
      if (run.context.read(INPUT_OTP_VISUAL).length !== length)
        run.context.update(INPUT_OTP_VISUAL, { length });
    };
    def.context.subscribe(INPUT_OTP_VISUAL);
    def.lifecycle.onCreated(syncLength);
    def.props.watch(['length'], syncLength);
    return inherited.render;
  },
});
