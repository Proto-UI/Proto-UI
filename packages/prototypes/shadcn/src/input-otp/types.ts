import type {
  InputOtpRootProps,
  InputOtpInputProps,
  InputOtpSlotProps,
} from '@proto.ui/prototypes-base/input-otp';
import type { ShadcnStyleProps } from '../style-scope';
export type ShadcnInputOtpRootProps = InputOtpRootProps &
  ShadcnStyleProps & {
    /** Paint-only invalid flag projected onto child slots and standalone editor. */
    invalid?: boolean;
  };
export type ShadcnInputOtpInputProps = InputOtpInputProps & ShadcnStyleProps;
export type ShadcnInputOtpSlotProps = InputOtpSlotProps &
  ShadcnStyleProps & {
    /** Mark this slot as visually invalid. */
    invalid?: boolean;
    /** Explicit first-in-group boundary override for split layouts around Separator. */
    first?: boolean;
    /** Explicit last-in-group boundary override for split layouts around Separator. */
    last?: boolean;
  };
export type ShadcnInputOtpSeparatorProps = ShadcnStyleProps;
