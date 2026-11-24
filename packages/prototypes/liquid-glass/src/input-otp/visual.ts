import { createContextKey } from '@proto.ui/core';
import type { InputOtpRootProps, InputOtpSlotProps } from '@proto.ui/prototypes-base/input-otp';

export const LIQUID_GLASS_INPUT_OTP_VISUAL = createContextKey<{
  disabled: boolean;
  invalid: boolean;
}>('liquid-glass-input-otp-visual');

export type LiquidGlassInputOtpRootProps = InputOtpRootProps & {
  invalid?: boolean;
};

export type LiquidGlassInputOtpSlotProps = InputOtpSlotProps & {
  invalid?: boolean;
};
