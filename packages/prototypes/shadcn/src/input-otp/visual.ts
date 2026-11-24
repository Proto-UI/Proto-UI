import { createContextKey } from '@proto.ui/core';

/** Paint-only projection of Base's normalized length, disabled, and visual invalid state. */
export const INPUT_OTP_VISUAL = createContextKey<{
  length: number;
  disabled: boolean;
  invalid: boolean;
}>('shadcn-input-otp-visual');
