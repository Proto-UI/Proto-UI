import type { SurfaceRootProps } from '@proto.ui/prototypes-base/surface';
import type { TextRootProps } from '@proto.ui/prototypes-base/text';
import { shadcnActionAppearance } from '@proto.ui/prototypes-shadcn/surface';
import { brutalistActionAppearance } from '@proto.ui/prototypes-brutalist/surface';
import { bootstrap232ActionAppearance } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';
import type { NativeLinkFacts } from './site-native-link-facts';
import type { SiteLibraryFamily } from './site-library-family';
import { SITE_LINK_ICONS, type SiteLinkIcon } from '../prototypes/site-link-icons';
export type SiteLinkAppearance =
  | 'action'
  | 'icon'
  | 'nav'
  | 'text'
  | 'pill'
  | 'brand'
  | 'nav-group'
  | 'sidebar'
  | 'toc'
  | 'pagination';
export type SidebarTextRole = 'row' | 'top-group' | 'nested-group';

/** Finite website composition density, matching the native Sidebar first frame.
 * Applied through the public Text surfaceStyle projection, not selector paint. */
export function sidebarTextSurfaceStyle(role: SidebarTextRole): Record<string, string> {
  return { fontSize: role === 'top-group' ? '0.75rem' : '0.8125rem', lineHeight: '1.25rem' };
}

/** Ordinary reading TOC uses its accepted native .8rem / 1.25 line box. */
export function readingTocTextSurfaceStyle(): Record<string, string> {
  return {
    fontSize: '0.8rem',
    lineHeight: '1rem',
    fontFamily: 'inherit',
    letterSpacing: 'inherit',
  };
}

export type SiteLinkEmphasis = 'primary' | 'secondary' | 'minimal' | 'link';
const initial: NativeLinkFacts = {
  hovered: false,
  focusVisible: false,
  pressed: false,
  current: false,
};
export function navbarLinkContext(link: Element): 'default' | 'navbar' {
  return link.closest('[data-site-header]') &&
    !link.closest('[data-site-header-panel]') &&
    !!link.closest('.site-header-brand, [data-site-header-desktop-navigation]')
    ? 'navbar'
    : 'default';
}

/** The archived Navbar has its own 20px brand and 14px navigation, independent
 * of the general Text size scale. These are public Text layout inputs at the
 * website composition boundary; the family still owns ink and state paint. */
export function navbarLinkTextStyle(
  family: SiteLibraryFamily,
  appearance: SiteLinkAppearance,
  colorContext: 'default' | 'navbar'
): Record<string, string> {
  return family === 'bootstrap-2-3-2' &&
    colorContext === 'navbar' &&
    (appearance === 'brand' || appearance === 'nav')
    ? {
        fontSize: appearance === 'brand' ? '20px' : '14px',
        lineHeight: '20px',
        fontWeight: appearance === 'brand' ? '200' : '400',
        letterSpacing: 'normal',
      }
    : {};
}

/** Choose a public family recipe; native anchor identity is not rewritten. */
export function linkActionAppearance(
  family: SiteLibraryFamily,
  emphasis: SiteLinkEmphasis,
  facts = initial
) {
  const options = { ...facts, emphasis: emphasis === 'link' ? ('minimal' as const) : emphasis };
  return family === 'brutalist'
    ? brutalistActionAppearance(options)
    : family === 'bootstrap-2-3-2'
      ? bootstrap232ActionAppearance(options)
      : shadcnActionAppearance({ ...options, styleProfile: 'luma' });
}
export function linkSurfaceProps(
  family: SiteLibraryFamily,
  appearance: SiteLinkAppearance,
  emphasis: SiteLinkEmphasis,
  facts = initial,
  colorContext: 'default' | 'navbar' = 'default'
): SurfaceRootProps & { colorContext?: 'default' | 'navbar' } {
  if (
    family === 'bootstrap-2-3-2' &&
    colorContext === 'navbar' &&
    ['brand', 'nav'].includes(appearance)
  )
    return {
      variant: 'transparent',
      radius: 'none',
      border: 'none',
      elevation: 'none',
      colorContext: 'navbar',
      focusVisible: facts.focusVisible,
      hovered: appearance === 'nav' && facts.hovered,
      pressed: appearance === 'nav' && facts.pressed,
      current: appearance === 'nav' && facts.current,
    };
  // The shared TOC range owns background selection. The native anchor and
  // Text still consume current/hover facts; this passive row keeps focus only
  // (plus the family's existing pressed feedback), never a second fill.
  if (appearance === 'toc')
    return {
      variant: 'transparent',
      radius: family === 'brutalist' ? 'default' : 'md',
      border: 'none',
      elevation: 'none',
      focusVisible: facts.focusVisible,
      hovered: false,
      pressed: facts.pressed,
      current: false,
    };
  if (family === 'shadcn' && appearance === 'nav')
    return shadcnActionAppearance({
      styleProfile: 'luma',
      emphasis: 'minimal',
      ...facts,
      // Ordinary navigation retains its native text-selection and stationary
      // press policy; the shared Luma recipe still owns hover/current/focus.
      pressed: false,
      hovered: facts.hovered || facts.current,
    }).surface;
  if (appearance === 'action') return linkActionAppearance(family, emphasis, facts).surface;
  // Community icons share the selected Luma paint, not Button semantics.
  // Their existing 44px native-link target remains in linkSurfaceLayout.
  if (family === 'shadcn' && appearance === 'icon')
    return shadcnActionAppearance({
      styleProfile: 'luma',
      emphasis: emphasis === 'link' ? 'minimal' : emphasis,
      ...facts,
    }).surface;
  const action =
    ['icon', 'pagination'].includes(appearance) && !['minimal', 'link'].includes(emphasis);
  const shadcnPagination = family === 'shadcn' && appearance === 'pagination';
  const framedNavigation = family === 'brutalist' && ['brand', 'nav'].includes(appearance);
  const framed = action || framedNavigation;
  const group = appearance === 'nav-group';
  const row = appearance === 'sidebar';
  return {
    variant:
      row && (facts.current || (family === 'brutalist' && facts.hovered))
        ? 'accent'
        : shadcnPagination
          ? 'secondary'
          : framed
            ? family === 'brutalist'
              ? 'secondary'
              : 'outline'
            : 'transparent',
    radius: framed
      ? family === 'brutalist'
        ? 'default'
        : 'lg'
      : row || group
        ? family === 'brutalist'
          ? 'default'
          : 'md'
        : 'none',
    border: shadcnPagination
      ? 'none'
      : framed || (family === 'brutalist' && row && (facts.current || facts.hovered))
        ? 'all'
        : family === 'brutalist' && group
          ? 'bottom'
          : 'none',
    elevation: framed && family === 'brutalist' ? 'raised' : 'none',
    // The Hero's native anchor owns its outer pill ring, including the
    // fallback. Its inner passive Surface must not paint a second rectangle.
    focusVisible: appearance === 'pill' ? false : facts.focusVisible,
    hovered: framed || row || group ? facts.hovered : false,
    pressed: facts.pressed,
    current: row && facts.current,
  };
}
export function linkTextProps(
  appearance: SiteLinkAppearance,
  facts = initial,
  family: SiteLibraryFamily = 'shadcn',
  sidebarRole?: SidebarTextRole,
  readingToc = false,
  colorContext: 'default' | 'navbar' = 'default'
): TextRootProps {
  if (
    family === 'bootstrap-2-3-2' &&
    colorContext === 'navbar' &&
    (appearance === 'nav' || appearance === 'brand')
  )
    return {
      size: 'base',
      tone: 'inherit',
      weight: 'normal',
      font: 'body',
      leading: 'size',
      tracking: 'normal',
      emphasis: 'normal',
      decoration: 'none',
    };
  if (family === 'shadcn' && appearance === 'nav')
    return {
      ...shadcnActionAppearance({ styleProfile: 'luma', emphasis: 'minimal', ...facts }).text,
      weight: facts.current ? 'semibold' : 'medium',
    };
  if (appearance === 'action') return linkActionAppearance(family, 'primary', facts).text;
  if (family === 'shadcn' && appearance === 'icon')
    return shadcnActionAppearance({ styleProfile: 'luma', ...facts }).text;
  const quietNavigation = family === 'shadcn' && (appearance === 'sidebar' || appearance === 'toc');
  return {
    size:
      appearance === 'brand'
        ? 'base'
        : appearance === 'nav-group' || appearance === 'pill'
          ? 'xs'
          : 'sm',
    tone:
      appearance === 'nav-group' &&
      sidebarRole !== 'nested-group' &&
      !facts.hovered &&
      !facts.focusVisible
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
    leading:
      appearance === 'sidebar' || appearance === 'nav-group' || readingToc ? 'size' : 'normal',
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
  facts = initial,
  readingToc = false,
  colorContext: 'default' | 'navbar' = 'default'
): Record<string, string> {
  if (
    family === 'bootstrap-2-3-2' &&
    colorContext === 'navbar' &&
    (appearance === 'nav' || appearance === 'brand')
  )
    return {
      pointerEvents: 'none',
      display: 'inline-flex',
      boxSizing: 'border-box',
      flexShrink: '0',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '0',
      maxWidth: '100%',
      minHeight: 'var(--site-header-row-height, 40px)',
      marginBottom: '0',
      padding: appearance === 'brand' ? '10px 0' : '10px 15px',
    };
  if (family === 'shadcn' && appearance === 'nav') {
    const {
      userSelect: _userSelect,
      WebkitUserSelect: _WebkitUserSelect,
      ...layout
    } = shadcnActionAppearance({ styleProfile: 'luma', emphasis: 'minimal', ...facts }).layout;
    return {
      ...layout,
      minHeight: 'var(--site-control-height, 2.75rem)',
      pointerEvents: 'none',
    };
  }
  if (appearance === 'action') {
    return { ...linkActionAppearance(family, emphasis, facts).layout, pointerEvents: 'none' };
  }
  if (appearance === 'sidebar' || appearance === 'nav-group') {
    const borderedRow =
      family === 'brutalist' && appearance === 'sidebar' && (facts.current || facts.hovered);
    return {
      pointerEvents: 'none',
      display: 'flex',
      flexShrink: '0',
      alignItems: 'center',
      justifyContent: 'space-between',
      minWidth: '0',
      maxWidth: '100%',
      width: '100%',
      minHeight: 'var(--site-navigation-row-height, 2rem)',
      marginBottom: '0',
      gap: '0.5rem',
      // Brutalist's existing 2px border remains inside the native 6px/8px inset.
      padding: borderedRow
        ? 'calc(0.375rem - 2px) calc(0.5rem - 2px)'
        : family === 'brutalist' && appearance === 'nav-group'
          ? '0.375rem 0.5rem calc(0.375rem - 2px)'
          : '0.375rem 0.5rem',
    };
  }
  if (appearance === 'toc' && readingToc)
    return {
      pointerEvents: 'none',
      display: 'flex',
      flexShrink: '0',
      alignItems: 'center',
      justifyContent: 'space-between',
      minWidth: '0',
      maxWidth: '100%',
      width: '100%',
      minHeight: '1.5rem',
      marginBottom: '0',
      padding: '0.25rem 0.5rem',
      paddingInlineStart: 'calc(1rem * var(--depth, 0) + 0.5rem)',
      gap: '0.5rem',
    };
  const row = ['toc', 'pagination'].includes(appearance);
  const raised =
    family === 'brutalist' &&
    (['brand', 'nav'].includes(appearance) ||
      (['icon', 'pagination'].includes(appearance) && ['primary', 'secondary'].includes(emphasis)));
  const size: Record<string, string> =
    appearance === 'icon'
      ? { width: '2.75rem', height: '2.75rem', padding: '0' }
      : appearance === 'pagination'
        ? { minHeight: '2.25rem', padding: '0.25rem 0.75rem', gap: '0.375rem' }
        : appearance === 'toc'
          ? {
              minHeight: 'var(--site-navigation-row-height, 2rem)',
              padding: '0.25rem 0.5rem',
              gap: '0.5rem',
            }
          : {
              minHeight: appearance === 'text' || appearance === 'pill' ? '1.5rem' : '2.75rem',
              padding:
                appearance === 'text' || appearance === 'pill'
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
