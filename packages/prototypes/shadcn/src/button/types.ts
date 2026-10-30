import type { ButtonExposes, ButtonProps } from '@proto.ui/prototypes-base/button';
import type { ShadcnStyleChoice, ShadcnStyleId, ShadcnStyleProps } from '../style-scope';

export type ShadcnButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

/** Explicit passive appearance; omission still preserves the ordinary atom. */
export type ShadcnActionStyleProfile = ShadcnStyleId | 'new-york';
export type ShadcnButtonStyleProfile = ShadcnStyleChoice;

export type ShadcnButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-compact';

export interface ShadcnButtonProps extends ButtonProps, ShadcnStyleProps {
  /** Explicit choice, then nearest scope, then the existing Rhea compatibility recipe. */
  styleProfile?: ShadcnButtonStyleProfile;
  variant?: ShadcnButtonVariant;
  size?: ShadcnButtonSize;
  /** Allow text labels to wrap within their available inline size; ignored for icon and icon-compact sizes. */
  wrap?: boolean;
}

export type ShadcnButtonExposes = ButtonExposes;
