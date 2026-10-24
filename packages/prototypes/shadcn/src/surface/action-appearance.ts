import type { ShadcnSurfaceRootProps } from './root.proto';
import type { ShadcnActionStyleProfile } from '../button/types';
import type { ShadcnTextRootProps } from '../text/root.proto';

export interface ShadcnActionAppearanceOptions {
  styleProfile?: ShadcnActionStyleProfile;
  emphasis?: 'primary' | 'secondary' | 'minimal';
  hovered?: boolean;
  pressed?: boolean;
  focusVisible?: boolean;
}

/** Public Web composition recipe, not a Link or Button interaction owner.
 * The native anchor supplies every fact and retains navigation/focus semantics.
 * Geometry follows the family's default wrapped Button; tests compare its
 * compiled dimensions rather than maintaining a website-specific height.
 */
export function shadcnActionAppearance(options: ShadcnActionAppearanceOptions = {}): {
  surface: ShadcnSurfaceRootProps;
  text: ShadcnTextRootProps;
  layout: Readonly<Record<string, string>>;
} {
  const styleProfile = options.styleProfile ?? 'rhea';
  const emphasis = options.emphasis ?? 'primary';
  return {
    surface: {
      actionProfile: styleProfile,
      variant:
        emphasis === 'primary' ? 'solid' : emphasis === 'secondary' ? 'secondary' : 'transparent',
      radius: 'none',
      border: 'none',
      elevation: 'none',
      hovered: options.hovered ?? false,
      pressed: options.pressed ?? false,
      focusVisible: options.focusVisible ?? false,
      current: false,
    },
    text: {
      actionProfile: styleProfile,
      size: 'sm',
      tone: 'inherit',
      weight: 'medium',
      font: 'body',
      leading: 'normal',
      decoration: 'none',
    },
    layout: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      minHeight: styleProfile === 'luma' ? '2.25rem' : '2rem',
      padding: '0.25rem 0.75rem',
      gap: '0.375rem',
      minWidth: '0',
      maxWidth: '100%',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      // The passive body translates, not its native navigation owner.
      // Preserve the one-pixel native hit envelope during the existing press.
      marginBottom: '1px',
    },
  };
}
