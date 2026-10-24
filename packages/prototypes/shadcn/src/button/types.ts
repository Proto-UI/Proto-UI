import type { ButtonExposes, ButtonProps } from '@proto.ui/prototypes-base/button';

export type ShadcnButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

export type ShadcnActionStyleProfile = 'rhea' | 'luma';
export type ShadcnButtonStyleProfile = ShadcnActionStyleProfile | 'new-york';

export type ShadcnButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-compact';

export interface ShadcnButtonProps extends ButtonProps {
  /** Rhea is the homepage card profile; Luma is the explicit hero profile; new-york retains the pinned legacy direct Button. */
  styleProfile?: ShadcnButtonStyleProfile;
  variant?: ShadcnButtonVariant;
  size?: ShadcnButtonSize;
  /** Allow text labels to wrap within their available inline size; ignored for icon and icon-compact sizes. */
  wrap?: boolean;
}

export type ShadcnButtonExposes = ButtonExposes;
