import type { InputOtpSeparatorExposes } from '@proto.ui/prototypes-base/input-otp';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputOtpSeparator } from '@proto.ui/prototypes-base/input-otp';
import { setupShadcnStyleSelection } from '../style-scope';
import type { ShadcnInputOtpSeparatorProps } from './types';

export default definePrototype<ShadcnInputOtpSeparatorProps, InputOtpSeparatorExposes>({
  name: 'shadcn-input-otp-separator',
  modules: asInputOtpSeparator.modules,
  setup(def) {
    const inherited = asInputOtpSeparator();
    setupShadcnStyleSelection(def, 'nova');
    // Retain the Base slot while giving dividers balanced spacing and muted tone.
    def.feedback.style.use(
      tw('inline-flex shrink-0 items-center justify-center px-2 text-muted-foreground select-none')
    );
    return inherited.render;
  },
});
