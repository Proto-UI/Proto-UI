import type { SurfaceRootProps } from '@proto.ui/prototypes-base/surface';
import type { TextRootProps } from '@proto.ui/prototypes-base/text';

export interface BrutalistActionAppearanceOptions {
  emphasis?: 'primary' | 'secondary' | 'minimal';
  hovered?: boolean;
  pressed?: boolean;
  focusVisible?: boolean;
}

/** Public passive Web composition, never a navigation/activation owner.
 * Its default body follows Brutalist Button, not another family's dimensions.
 * The separate native anchor must retain its complete browser-owned behavior.
 */
export function brutalistActionAppearance(options: BrutalistActionAppearanceOptions = {}): {
  surface: SurfaceRootProps;
  text: TextRootProps;
  layout: Readonly<Record<string, string>>;
} {
  const emphasis = options.emphasis ?? 'primary';
  const framed = emphasis !== 'minimal';
  return {
    surface: {
      variant:
        emphasis === 'primary' ? 'solid' : emphasis === 'secondary' ? 'secondary' : 'transparent',
      radius: 'default',
      border: framed ? 'all' : 'none',
      elevation: framed ? 'raised' : 'none',
      hovered: options.hovered ?? false,
      pressed: options.pressed ?? false,
      focusVisible: options.focusVisible ?? false,
      current: false,
    },
    text: {
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
      minHeight: '2.5rem',
      padding: '0.25rem 1rem',
      gap: '0.5rem',
      minWidth: '0',
      maxWidth: '100%',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      // Reserve the hard-shadow travel in the native anchor's hit envelope.
      marginRight: framed ? '0.25rem' : '0',
      marginBottom: framed ? '0.25rem' : '1px',
    },
  };
}
