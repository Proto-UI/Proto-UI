import type { SurfaceRootProps } from '@proto.ui/prototypes-base/surface';
import type { TextRootProps } from '@proto.ui/prototypes-base/text';
import type { NativeLinkFacts } from './site-native-link-facts';
import type { SiteLibraryFamily } from './site-library-family';
import { SITE_LINK_ICONS, type SiteLinkIcon } from '../prototypes/site-link-icons';
export type SiteLinkAppearance =
  | 'action'
  | 'icon'
  | 'nav'
  | 'text'
  | 'brand'
  | 'nav-group'
  | 'sidebar'
  | 'toc'
  | 'pagination';
export type SiteLinkEmphasis = 'primary' | 'secondary' | 'minimal' | 'link';
const initial: NativeLinkFacts = {
  hovered: false,
  focusVisible: false,
  pressed: false,
  current: false,
};
export function linkSurfaceProps(
  family: SiteLibraryFamily,
  appearance: SiteLinkAppearance,
  emphasis: SiteLinkEmphasis,
  facts = initial
): SurfaceRootProps {
  const action =
    ['action', 'icon', 'pagination'].includes(appearance) &&
    !['minimal', 'link'].includes(emphasis);
  const framedNavigation = family === 'brutalist' && ['brand', 'nav'].includes(appearance);
  const framed = action || framedNavigation;
  const group = appearance === 'nav-group';
  const row = appearance === 'sidebar' || appearance === 'toc';
  return {
    variant:
      row && (facts.current || (family === 'brutalist' && facts.hovered))
        ? 'accent'
        : framed
          ? emphasis === 'primary' && appearance === 'action'
            ? 'solid'
            : family === 'brutalist'
              ? 'secondary'
              : 'outline'
          : 'transparent',
    radius: framed
      ? family === 'brutalist'
        ? 'default'
        : 'lg'
      : row
        ? family === 'brutalist'
          ? 'default'
          : 'md'
        : 'none',
    border:
      framed || (family === 'brutalist' && row && (facts.current || facts.hovered))
        ? 'all'
        : family === 'brutalist' && group
          ? 'bottom'
          : 'none',
    elevation: framed && family === 'brutalist' ? 'raised' : 'none',
    focusVisible: facts.focusVisible,
    hovered: framed || row || group ? facts.hovered : false,
    pressed: facts.pressed,
    current: row && facts.current,
  };
}
export function linkTextProps(
  appearance: SiteLinkAppearance,
  facts = initial,
  family: SiteLibraryFamily = 'shadcn'
): TextRootProps {
  const quietNavigation = family === 'shadcn' && (appearance === 'sidebar' || appearance === 'toc');
  return {
    size: appearance === 'brand' ? 'base' : appearance === 'nav-group' ? 'xs' : 'sm',
    tone:
      appearance === 'nav-group' && !facts.hovered && !facts.focusVisible
        ? 'muted'
        : appearance === 'toc' && !facts.hovered && !facts.current && !facts.inView
          ? 'muted'
          : 'inherit',
    weight: quietNavigation
      ? facts.current
        ? 'medium'
        : 'normal'
      : facts.current ||
          appearance === 'brand' ||
          (family === 'brutalist' && appearance === 'nav-group')
        ? 'semibold'
        : 'medium',
    font: 'body',
    leading: 'normal',
    tracking: appearance === 'brand' ? 'tight' : 'normal',
    emphasis: 'normal',
    decoration:
      (appearance === 'nav' || appearance === 'text') && (facts.hovered || facts.current)
        ? 'underline'
        : 'none',
  };
}
export function linkSurfaceLayout(
  family: SiteLibraryFamily,
  appearance: SiteLinkAppearance,
  emphasis: SiteLinkEmphasis,
  facts = initial
): Record<string, string> {
  const row = ['sidebar', 'toc', 'pagination', 'nav-group'].includes(appearance);
  const raised =
    family === 'brutalist' &&
    (['brand', 'nav'].includes(appearance) ||
      (['action', 'icon', 'pagination'].includes(appearance) &&
        ['primary', 'secondary'].includes(emphasis)));
  const size: Record<string, string> =
    appearance === 'icon'
      ? { width: '2.75rem', height: '2.75rem', padding: '0' }
      : appearance === 'action'
        ? { minHeight: '2.75rem', padding: '0.5rem 1rem', gap: '0.5rem', overflowWrap: 'anywhere' }
        : appearance === 'pagination'
          ? { minHeight: '2.25rem', padding: '0.25rem 0.75rem', gap: '0.375rem' }
          : appearance === 'sidebar' || appearance === 'toc' || appearance === 'nav-group'
            ? {
                minHeight: 'var(--site-navigation-row-height, 2rem)',
                // Preserve the same 4px/8px content inset when the public border appears.
                padding:
                  family === 'brutalist' &&
                  appearance !== 'nav-group' &&
                  (facts.current || facts.hovered)
                    ? '0.125rem 0.375rem'
                    : '0.25rem 0.5rem',
                gap: '0.5rem',
              }
            : {
                minHeight: appearance === 'text' ? '1.5rem' : '2.75rem',
                padding:
                  appearance === 'text'
                    ? '0'
                    : family === 'brutalist'
                      ? '0.5rem 0.75rem'
                      : '0.5rem 0',
              };
  return {
    pointerEvents: 'none',
    display: row ? 'flex' : 'inline-flex',
    flexShrink: '0',
    alignItems: 'center',
    justifyContent: row ? 'space-between' : 'center',
    minWidth: '0',
    maxWidth: '100%',
    ...(row ? { width: '100%' } : {}),
    ...(raised ? { marginRight: '0.25rem', marginBottom: '0.25rem' } : { marginBottom: '1px' }),
    ...size,
  };
}
/** Brand artwork is page content. It is not embedded in a control Prototype. */
export function appendSiteLinkGlyph(slot: HTMLElement, icon: SiteLinkIcon) {
  const source = SITE_LINK_ICONS[icon];
  const svg = slot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', source.viewBox);
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  const path = slot.ownerDocument.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', source.path);
  svg.append(path);
  slot.append(svg);
}
