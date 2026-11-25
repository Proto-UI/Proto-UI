/** Website consumer identity. Runtime/adapter choice is a separate axis. */
export type SiteLibraryFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2';

/** Preview/code-panel controls adapt across all four documented library families. */
export type PreviewControlFamily = SiteLibraryFamily | 'liquid-glass';

/** Whole-site compositions need the complete control families. Partial library
 * demos have their own explicit registry and cannot be silently admitted here. */
export function requireSiteLibraryFamily(value: unknown): SiteLibraryFamily {
  if (value === 'shadcn' || value === 'brutalist' || value === 'bootstrap-2-3-2') return value;
  throw new Error(`[SiteLibraryFamily] unsupported whole-site family: ${String(value)}`);
}

/** Library routes own the document family; Base and editorial routes use the site default. */
export function resolveSiteLibraryFamily(pathname: string): SiteLibraryFamily {
  if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?ui-libraries\/brutalist(?:\/|$)/i.test(pathname))
    return 'brutalist';
  if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?ui-libraries\/bootstrap-2-3-2(?:\/|$)/i.test(pathname))
    return 'bootstrap-2-3-2';
  return 'shadcn';
}

export function resolvePreviewControlFamily(
  pathname: string,
  explicitFamily?: string | null
): PreviewControlFamily {
  if (
    explicitFamily === 'shadcn' ||
    explicitFamily === 'brutalist' ||
    explicitFamily === 'bootstrap-2-3-2' ||
    explicitFamily === 'liquid-glass'
  ) {
    return explicitFamily;
  }
  if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?ui-libraries\/liquid-glass(?:\/|$)/i.test(pathname))
    return 'liquid-glass';
  return resolveSiteLibraryFamily(pathname);
}

export function previewButtonTag(family: PreviewControlFamily) {
  return `wc-${family}-button` as const;
}

export function runtimePreviewFamily(root: HTMLElement): PreviewControlFamily {
  for (let scope: HTMLElement | null = root; scope; scope = scope.parentElement) {
    const family =
      scope.dataset.projectionFamily ??
      scope.dataset.previewControlFamily ??
      scope.dataset.siteLibraryFamily;
    if (
      family === 'shadcn' ||
      family === 'brutalist' ||
      family === 'bootstrap-2-3-2' ||
      family === 'liquid-glass'
    )
      return family;
    if (scope.classList.contains('brutalist-demo-frame')) return 'brutalist';
  }
  return resolvePreviewControlFamily(root.ownerDocument.defaultView?.location.pathname ?? '/');
}

export function siteControlTags(family: SiteLibraryFamily) {
  return {
    Button: `wc-${family}-button`,
    SelectRoot: `wc-${family}-select-root`,
    SelectTrigger: `wc-${family}-select-trigger`,
    SelectValue: `wc-${family}-select-value`,
    SelectContent: `wc-${family}-select-content`,
    SelectItem: `wc-${family}-select-item`,
    SelectSurface: `wc-${family}-select-surface`,
    SelectViewport: `wc-${family}-select-viewport`,
    SelectGroup: `wc-${family}-select-group`,
    SelectItemText: `wc-${family}-select-item-text`,
  } as const;
}

/** Call only at the active page scope's successful projection commit. */
export function applySiteLibraryFamily(doc: Document, family: SiteLibraryFamily): void {
  if (doc.documentElement.dataset.siteLibraryFamily !== family)
    doc.documentElement.dataset.siteLibraryFamily = family;
  // A same-family commit still reconciles any newly mounted or stale scopes.
  doc.querySelectorAll<HTMLElement>('[data-site-family-scope]').forEach((scope) => {
    if (scope.dataset.siteLibraryFamily !== family) scope.dataset.siteLibraryFamily = family;
  });
}
