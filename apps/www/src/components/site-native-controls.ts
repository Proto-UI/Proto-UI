import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import SiteLinkSurface, {
  type SiteLinkAppearance,
  type SiteLinkEmphasis,
  type SiteLinkSurfaceProps,
} from '../prototypes/site-link-surface.proto';
import { type SiteLinkIcon } from '../prototypes/site-link-icons';
import { bindNativeLinkFacts } from './site-native-link-facts';
import { resolveSiteLibraryFamily, type SiteLibraryFamily } from './site-library-family';
import { resolveProjectionThemeSurfaceStyle } from './PrototypePreviewer/projection-theme';

const SITE_LINK_TAG = 'wc-site-link-surface';
const bindings = new WeakMap<HTMLAnchorElement, () => void>();

export function siteLinkAppearance(link: HTMLAnchorElement): SiteLinkAppearance {
  if (link.hasAttribute('data-home-brand')) return 'brand';
  const requested = link.dataset.siteLinkAppearance;
  if (
    requested === 'action' ||
    requested === 'icon' ||
    requested === 'nav' ||
    requested === 'text' ||
    requested === 'brand' ||
    requested === 'sidebar' ||
    requested === 'toc' ||
    requested === 'pagination'
  )
    return requested;
  if (link.closest('.homepage-hero__eyebrow')) return 'text';
  if (link.closest('.sidebar-pane .top-level')) return 'sidebar';
  if (link.closest('.pagination-links')) return 'pagination';
  if (link.closest('sl-toc')) return 'toc';
  if (link.closest('[data-site-header-navigation], [data-site-header-desktop-navigation]'))
    return 'nav';
  return link.dataset.homeActionVariant === 'minimal' || link.dataset.homeActionVariant === 'link'
    ? 'text'
    : 'action';
}

/** Keep Starlight's localized label, line break and title nodes. Only the
 * existing caption becomes visually hidden; the native accessible name still
 * includes Previous/Next and the title. Releasing restores exact node order. */
function preparePaginationCaption(link: HTMLAnchorElement): () => void {
  if (siteLinkAppearance(link) !== 'pagination') return () => {};
  const title = link.querySelector('.link-title');
  const label = title?.parentElement;
  if (!title || !label) return () => {};
  const before: ChildNode[] = [];
  for (const node of label.childNodes) {
    if (node === title) break;
    before.push(node);
  }
  if (!before.length) return () => {};
  const caption = link.ownerDocument.createElement('span');
  caption.dataset.sitePaginationCaption = '';
  caption.append(...before);
  label.insertBefore(caption, title);
  return () => caption.replaceWith(...before);
}
export function siteLinkEmphasis(link: HTMLAnchorElement): SiteLinkEmphasis {
  const value = link.dataset.homeActionVariant;
  return value === 'primary' || value === 'minimal' || value === 'link' ? value : 'secondary';
}
export function siteLinkIcon(link: HTMLAnchorElement): SiteLinkIcon | 'none' {
  const value = link.dataset.siteLinkIcon;
  return value === 'github' || value === 'discord' || value === 'x' || value === 'bluesky'
    ? value
    : 'none';
}

/** Enhances existing SSR anchors, never replaces their native navigation root.
 * Homepage-owned groups use the same Prototype through their four-runtime
 * transaction; this small WC bridge is only for static documentation chrome. */
export function initSiteNativeControls(scope: ParentNode = document): () => void {
  const document = scope.nodeType === 9 ? (scope as Document) : (scope as Node).ownerDocument;
  if (!document) return () => {};
  const view = document.defaultView;
  if (!view) return () => {};
  if (!view.customElements.get(SITE_LINK_TAG)) {
    const Constructor = AdaptToWebComponent(SiteLinkSurface, {
      register: false,
      registerAs: SITE_LINK_TAG,
    });
    view.customElements.define(SITE_LINK_TAG, Constructor);
  }
  const releases: Array<() => void> = [];
  for (const link of scope.querySelectorAll<HTMLAnchorElement>(
    'a[data-site-native-link], a[data-site-native-button], .sidebar-pane .top-level a[href], .pagination-links a[href], sl-toc a[href]'
  )) {
    if (link.closest('[data-homepage-actions]') || bindings.has(link)) continue;
    let alive = true;
    const appearance = siteLinkAppearance(link);
    const restoreCaption = preparePaginationCaption(link);
    const surface = document.createElement(SITE_LINK_TAG);
    surface.dataset.siteLinkContent = '';
    // Keep SSR glyph/text nodes: the passive slot never takes ownership of the
    // anchor's name, destination, focus target, or default browser action.
    const content = Array.from(link.childNodes);
    surface.append(...content);
    link.append(surface);
    link.classList.add('site-native-link');
    link.dataset.siteLinkEnhanced = 'true';
    link.dataset.siteLinkAppearance = appearance;
    link.dataset.siteNativeLink = '';
    link.removeAttribute('data-slot');
    link.removeAttribute('data-site-native-button');
    let facts = { hovered: false, pressed: false, focusVisible: false, current: false };
    const update = () => {
      if (!alive) return;
      const family: SiteLibraryFamily =
        document.documentElement.dataset.siteLibraryFamily === 'brutalist'
          ? 'brutalist'
          : resolveSiteLibraryFamily(view.location.pathname);
      const props: SiteLinkSurfaceProps & { surfaceStyle: Record<string, string> } = {
        family,
        appearance,
        emphasis: siteLinkEmphasis(link),
        icon: 'none',
        ...facts,
        surfaceStyle: resolveProjectionThemeSurfaceStyle(family, document.documentElement),
      };
      setElementProps(surface, props);
      // Direct props can arrive during Custom Element upgrade. Replay only
      // while this exact native link binding still owns the surface.
      queueMicrotask(() => {
        if (alive && surface.isConnected)
          (surface as HTMLElement & { setProps?: (props: unknown) => void }).setProps?.(props);
      });
    };
    const unbind = bindNativeLinkFacts(link, (next) => {
      facts = next;
      update();
    });
    const observer = new view.MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-site-library-family'],
    });
    const media = view.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', update);
    const release = () => {
      if (!alive) return;
      // The fact bridge clears its contribution before the binding is torn
      // down; no queued replay may modify the new page/generation afterwards.
      unbind();
      alive = false;
      observer.disconnect();
      media?.removeEventListener?.('change', update);
      bindings.delete(link);
      restoreCaption();
      if (surface.parentElement === link) {
        surface.replaceWith(...Array.from(surface.childNodes));
        delete link.dataset.siteLinkEnhanced;
      }
    };
    bindings.set(link, release);
    releases.push(release);
  }
  return () => {
    for (const release of releases) release();
  };
}
