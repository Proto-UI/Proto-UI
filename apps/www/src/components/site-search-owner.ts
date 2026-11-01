import { createSitePagefindResource } from './site-pagefind-resource';
import { createSiteSearchSession } from './site-search-session';
import type { SiteSearchCopy } from './site-search-composition';

/** Data and localization owner, independent of the page's replaceable four-host view. */
export function createSiteSearchOwner(root: HTMLElement) {
  const view = root.ownerDocument.defaultView;
  if (!view) throw new Error('Search requires a browsing document');
  const raw = JSON.parse(root.dataset.searchCopy || '{}') as Record<string, unknown>;
  const text = (key: string) => {
    const value = raw[key];
    if (typeof value !== 'string' || !value) throw new Error(`Missing Search copy: ${key}`);
    return value;
  };
  const countTemplate = text('count');
  const copy: SiteSearchCopy = {
    title: text('title'),
    description: text('description'),
    placeholder: text('placeholder'),
    hint: text('hint'),
    loading: text('loading'),
    empty: text('empty'),
    error: text('error'),
    retry: text('retry'),
    more: text('more'),
    close: text('close'),
    pages: typeof raw.pages === 'string' ? raw.pages : undefined,
    results: typeof raw.results === 'string' ? raw.results : undefined,
    goToPage: typeof raw.goToPage === 'string' ? raw.goToPage : undefined,
    count: (count) => countTemplate.replace('{count}', String(count)),
  };
  if (!root.dataset.pagefindBundle) throw new Error('Missing Pagefind bundle URL');
  const resource = createSitePagefindResource({
    bundleURL: root.dataset.pagefindBundle,
    origin: view.location.origin,
    importModule: (url) => import(/* @vite-ignore */ url),
  });
  const rawNavigation: unknown = JSON.parse(root.dataset.searchNavigation || '[]');
  if (!Array.isArray(rawNavigation)) throw new Error('Malformed default Search navigation');
  const navigation = rawNavigation.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('title' in entry) ||
      !('href' in entry) ||
      typeof entry.title !== 'string' ||
      typeof entry.href !== 'string'
    )
      throw new Error('Malformed default Search navigation');
    return { title: entry.title, href: entry.href };
  });
  const session = createSiteSearchSession({
    navigation,
    load: resource.load,
    origin: view.location.origin,
    navigate(href) {
      view.location.assign(href);
    },
    formatURL(path) {
      if (!root.hasAttribute('data-strip-trailing-slash')) return path;
      const url = new URL(path, view.location.origin);
      if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '');
      return url.pathname + url.search + url.hash;
    },
  });
  let alive = true;
  return {
    copy,
    session,
    prepare() {
      if (!alive) return;
      void resource.load().then(
        () => {
          if (alive) root.dataset.searchPreparation = 'ready';
        },
        () => {
          if (alive) root.dataset.searchPreparation = 'unavailable';
        }
      );
    },
    fail(error: unknown) {
      if (!alive) return;
      root.dataset.searchCompositionError = 'true';
      session.setOpen(false);
      console.error('[SiteSearch] Public composition failed.', error);
    },
    dispose() {
      if (!alive) return;
      alive = false;
      session.dispose();
      resource.dispose();
    },
  };
}
