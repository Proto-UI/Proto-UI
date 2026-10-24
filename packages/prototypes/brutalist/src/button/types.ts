import type { ButtonExposes, ButtonProps } from '@proto.ui/prototypes-base/button';

/** Fill role. Every Brutalist control already carries a structural 2px outline. */
export type BrutalistButtonVariant = 'solid' | 'surface' | 'destructive';

/**
 * Accent fill for `variant="solid"`.
 * Each value maps to a fixed background/foreground pair that stays high-contrast
 * across Light and Dark host themes (accent text is always ink).
 */
export type BrutalistButtonColor = 'main' | 'mint' | 'lavender' | 'coral' | 'sky';

export type BrutalistButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface BrutalistButtonProps extends ButtonProps {
  /** Opt-in multiline label; preserves each family size minimum. Ignored for icon. */
  wrap?: boolean;
  // P-BRUTALIST-BUTTON-VARIANT-PROP
  variant?: BrutalistButtonVariant;
  // P-BRUTALIST-BUTTON-COLOR-PROP
  color?: BrutalistButtonColor;
  // P-BRUTALIST-BUTTON-SIZE-PROP
  size?: BrutalistButtonSize;
}

export type BrutalistButtonExposes = ButtonExposes;
