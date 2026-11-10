import type { TextRootProps } from '@proto.ui/prototypes-base/text';
import type { Bootstrap232SurfaceRootProps } from './root.proto';
import { bootstrapButtonDefaultLayout } from '../button/paint';

export interface Bootstrap232ActionAppearanceOptions {
  emphasis?: 'primary' | 'secondary' | 'minimal';
  hovered?: boolean;
  pressed?: boolean;
  focusVisible?: boolean;
}

/** Ordinary Button appearance for a native navigation owner. No event,
 * focus or activation protocol is installed by this passive composition. */
export function bootstrap232ActionAppearance(options: Bootstrap232ActionAppearanceOptions = {}): {
  surface: Bootstrap232SurfaceRootProps;
  text: TextRootProps;
  layout: Readonly<Record<string, string>>;
} {
  const emphasis = options.emphasis ?? 'primary';
  return {
    surface: {
      actionProfile: 'button',
      variant:
        emphasis === 'primary' ? 'solid' : emphasis === 'secondary' ? 'secondary' : 'transparent',
      radius: 'default',
      border: 'all',
      elevation: 'raised',
      hovered: options.hovered ?? false,
      pressed: options.pressed ?? false,
      focusVisible: options.focusVisible ?? false,
      current: false,
    },
    text: {
      size: 'base',
      tone: 'inherit',
      weight: 'normal',
      font: 'body',
      leading: 'size',
      decoration: 'none',
    },
    layout: bootstrapButtonDefaultLayout,
  };
}
