import type { ButtonExposes, ButtonProps } from '@proto.ui/prototypes-base/button';

export type ShadcnButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

export type ShadcnButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ShadcnButtonProps extends ButtonProps {
  variant?: ShadcnButtonVariant;
  size?: ShadcnButtonSize;
  /** Allow text labels to wrap within their available inline size; ignored for icon size. */
  wrap?: boolean;
}

export type ShadcnButtonExposes = ButtonExposes;
