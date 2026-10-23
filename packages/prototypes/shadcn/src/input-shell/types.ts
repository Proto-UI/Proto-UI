import type { InputRootProps, InputRootExposes } from '@proto.ui/prototypes-base/input';
import type { ShadcnStyleProps } from '../style-scope';
/** Bounded single inline-control presentation, not the full upstream InputGroup API. */
export type InputShellProps = ShadcnStyleProps & {
  /** Fact projection only; bind to the control rather than maintaining independent state. */
  focusVisible?: boolean;
  disabled?: boolean;
  /** Command upstream uses a different input slot and intentionally has no group focus ring. */
  focusIndicator?: 'ring' | 'none';
};
export type InputShellControlProps = InputRootProps & ShadcnStyleProps;
export type InputShellControlExposes = InputRootExposes;
