import { createContextKey } from '@proto.ui/core';
import type { InputOtpRootProps, InputOtpSlotProps } from '@proto.ui/prototypes-base/input-otp';

export const BRUTALIST_INPUT_OTP_VISUAL = createContextKey<{
  disabled: boolean;
  invalid: boolean;
}>('brutalist-input-otp-visual');

export type BrutalistInputOtpRootProps = InputOtpRootProps & {
  invalid?: boolean;
};

export type BrutalistInputOtpSlotProps = InputOtpSlotProps & {
  invalid?: boolean;
};
