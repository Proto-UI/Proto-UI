import type { ShadcnSurfaceRootProps } from './root.proto';
import type { ShadcnActionStyleProfile } from '../button/types';
import type { ShadcnTextRootProps } from '../text/root.proto';
import { normalizeShadcnStyle } from '../style-scope';

// Same source-bound default size as Button/profiles.ts and independent
// 02cad611 New York. This helper only composes existing passive atoms.
const ACTION_MIN_HEIGHT = {
  vega: '2.25rem',
  nova: '2rem',
  maia: '2.25rem',
  lyra: '2rem',
  mira: '1.75rem',
  luma: '2.25rem',
  sera: '2.5rem',
  rhea: '2rem',
  'new-york-v4': '2.25rem',
} as const;
const ACTION_PADDING = {
  vega: '0.25rem 0.625rem',
  nova: '0.25rem 0.625rem',
  maia: '0.25rem 0.75rem',
  lyra: '0.25rem 0.625rem',
  mira: '0.25rem 0.5rem',
  luma: '0.25rem 0.75rem',
  sera: '0.25rem 1.5rem',
  rhea: '0.25rem 0.75rem',
  'new-york-v4': '0.25rem 1rem',
} as const;

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
  const styleProfile = normalizeShadcnStyle(options.styleProfile) ?? 'rhea';
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
      size:
        styleProfile === 'lyra' || styleProfile === 'mira' || styleProfile === 'sera' ? 'xs' : 'sm',
      tone: 'inherit',
      weight: styleProfile === 'sera' ? 'semibold' : 'medium',
      font: 'body',
      leading: 'normal',
      decoration: 'none',
    },
    layout: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      minHeight: ACTION_MIN_HEIGHT[styleProfile],
      padding: ACTION_PADDING[styleProfile],
      gap:
        styleProfile === 'new-york-v4'
          ? '0.5rem'
          : styleProfile === 'mira'
            ? '0.25rem'
            : '0.375rem',
      minWidth: '0',
      maxWidth: '100%',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      // The passive body translates, not its native navigation owner.
      // Preserve the one-pixel native hit envelope during the existing press.
      marginBottom: styleProfile === 'new-york-v4' ? '0' : '1px',
    },
  };
}
