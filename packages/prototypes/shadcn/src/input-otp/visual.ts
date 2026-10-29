import { createContextKey } from '@proto.ui/core';

/** Paint-only projection of Base's normalized length; no code, completion or editor owner. */
export const INPUT_OTP_VISUAL = createContextKey<{ length: number }>('shadcn-input-otp-visual');
