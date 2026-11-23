import type { SiteLibraryFamily } from './site-library-family';

/** One public-Prototype composition choice for site chrome, not a paint layer.
 * The family owns radius, border, colors and interaction feedback. Layout only
 * owns available width and the common accessible target size. */
export function headerButtonProps(family: SiteLibraryFamily, size = 'icon') {
  return family === 'shadcn'
    ? { styleProfile: 'rhea' as const, variant: 'secondary' as const, size }
    : family === 'brutalist'
      ? { variant: 'surface' as const, size }
      : {
          variant: 'default' as const,
          size: 'default' as const,
          // Only the compact commands sit directly on the blue navbar. The
          // Search command retains a raised field-like ordinary Button.
          colorContext: size === 'icon' ? ('navbar' as const) : ('default' as const),
        };
}

export function headerSelectControlProps(family: SiteLibraryFamily) {
  return {
    // Popup width follows each family's own recipe; no per-consumer size policy.
    shadcnStyleProfile: 'rhea' as const,
    triggerAppearance: 'default' as const,
    compactTriggerAppearance: 'default' as const,
    brutalistTriggerAppearance: 'elevated' as const,
    wrapValue: true,
    labelPresentation: 'accessible' as const,
    minHeight: 'var(--site-control-height, 2.75rem)',
    paddingBlock: '0.25rem',
  };
}

/** Shared target geometry for SSR, WC upgrade and all projected runtimes. */
export function headerIconButtonLayout() {
  return {
    width: 'var(--site-header-icon-size, 2.75rem)',
    height: 'var(--site-header-icon-size, 2.75rem)',
    minHeight: 'var(--site-control-height, 2.75rem)',
    padding: '0',
    fontFamily: 'inherit',
  };
}

/** Header breakpoints change layout and visible copy atomically. Preserve family
 * feedback transitions, but never interpolate width/padding while text appears.
 * No colors, radii, duration, easing or reduced-motion policy are overridden. */
export function headerResponsiveButtonFeedback(family?: SiteLibraryFamily): Record<string, string> {
  // Bootstrap already limits its own transition to background-position. An
  // inline property list would override that family policy and its generated
  // reduced-motion rule, so this composition has nothing to narrow there.
  if (family === 'bootstrap-2-3-2') return {};
  return {
    transitionProperty:
      'color, background-color, border-color, outline-color, box-shadow, opacity, transform, translate, scale',
  };
}
