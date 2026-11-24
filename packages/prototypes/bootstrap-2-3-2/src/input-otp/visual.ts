import { createContextKey } from '@proto.ui/core';
import type { InputOtpRootProps, InputOtpSlotProps } from '@proto.ui/prototypes-base/input-otp';

export const BOOTSTRAP_INPUT_OTP_VISUAL = createContextKey<{
  disabled: boolean;
  invalid: boolean;
}>('bootstrap-2-3-2-input-otp-visual');

export type BootstrapInputOtpRootProps = InputOtpRootProps & {
  invalid?: boolean;
};

export type BootstrapInputOtpSlotProps = InputOtpSlotProps & {
  invalid?: boolean;
};
