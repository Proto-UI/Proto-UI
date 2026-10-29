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
    // Upstream sizes its supplied icon, not arbitrary authored children. Retain the Base slot.
    def.feedback.style.use(tw('flex items-center'));
    return inherited.render;
  },
});
