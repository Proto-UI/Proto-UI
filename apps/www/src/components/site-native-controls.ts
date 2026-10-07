import {
  withNativeContentLease,
  registerNativeContentContainer,
} from './PrototypePreviewer/native-content-lease';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import ShadcnSurface from '@proto.ui/prototypes-shadcn/surface';
import BrutalistSurface from '@proto.ui/prototypes-brutalist/surface';
import ShadcnText from '@proto.ui/prototypes-shadcn/text';
import BrutalistText from '@proto.ui/prototypes-brutalist/text';
import {
  linkSurfaceProps,
  linkSurfaceLayout,
  linkTextProps,
  type SiteLinkAppearance,
  type SiteLinkEmphasis,
} from './site-link-recipes';
import { type SiteLinkIcon } from '../prototypes/site-link-icons';
import { bindNativeLinkFacts } from './site-native-link-facts';
import { resolveSiteLibraryFamily, type SiteLibraryFamily } from './site-library-family';
import { resolveProjectionThemeSurfaceStyle } from './PrototypePreviewer/projection-theme';

const bindings = new WeakMap<HTMLElement, () => void>();

export function siteLinkAppearance(link: HTMLElement): SiteLinkAppearance {
  if (link.localName === 'summary') return 'nav-group';
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
function preparePaginationCaption(link: HTMLElement): () => void {
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
export function siteLinkEmphasis(link: HTMLElement): SiteLinkEmphasis {
  const value = link.dataset.homeActionVariant;
  return value === 'primary' || value === 'minimal' || value === 'link' ? value : 'secondary';
}
export function siteLinkIcon(link: HTMLElement): SiteLinkIcon | 'none' {
  const value = link.dataset.siteLinkIcon;
  return value === 'github' || value === 'discord' || value === 'x' || value === 'bluesky'
    ? value
    : 'none';
}

/** Enhances SSR anchors and summaries, preserving native navigation/disclosure owners.
 * Homepage-owned groups use the same Prototype through their four-runtime
 * transaction; this small WC bridge is only for static documentation chrome. */
export function initSiteNativeControls(scope: ParentNode = document): () => void {
  const document = scope.nodeType === 9 ? (scope as Document) : (scope as Node).ownerDocument;
  if (!document) return () => {};
  const view = document.defaultView;
  if (!view) return () => {};
  for (const [family, surface, text] of [
    ['shadcn', ShadcnSurface, ShadcnText],
    ['brutalist', BrutalistSurface, BrutalistText],
  ] as const) {
    for (const [part, proto] of [
      ['surface', surface],
      ['text', text],
    ] as const) {
      const tag = `wc-site-${family}-${part}`;
      if (!view.customElements.get(tag))
        view.customElements.define(
          tag,
          AdaptToWebComponent(proto, { register: false, registerAs: tag })
        );
    }
  }
  const ranges = [...scope.querySelectorAll<HTMLElement>('[data-site-toc-highlight]')].filter(
    (range) => !bindings.has(range)
  );
  const links = [
    ...scope.querySelectorAll<HTMLElement>(
      'a[data-site-native-link], a[data-site-native-button], .sidebar-pane .top-level a[href], .sidebar-pane .top-level summary, .pagination-links a[href], sl-toc a[href]'
    ),
  ].filter((link) => !link.closest('[data-homepage-actions]') && !bindings.has(link));
  if (!links.length && !ranges.length) return () => {};
  const readFamily = (): SiteLibraryFamily =>
    document.documentElement.dataset.siteLibraryFamily === 'brutalist'
      ? 'brutalist'
      : resolveSiteLibraryFamily(view.location.pathname);
  // Read one closed root theme before any native owner in this batch writes
  // its public Surface/Text. Each binding keeps its own native facts/content.
  let batchFamily = readFamily();
  let batchTheme = resolveProjectionThemeSurfaceStyle(batchFamily, document.documentElement);
  let themeFingerprint = JSON.stringify(batchTheme);
  let batchAlive = true;
  let initializing = true;
  const updates = new Set<() => void>();
  const refreshTheme = () => {
    if (!batchAlive) return false;
    const nextFamily = readFamily();
    const nextTheme = resolveProjectionThemeSurfaceStyle(nextFamily, document.documentElement);
    const nextFingerprint = JSON.stringify(nextTheme);
    if (nextFamily === batchFamily && nextFingerprint === themeFingerprint) return false;
    batchFamily = nextFamily;
    batchTheme = nextTheme;
    themeFingerprint = nextFingerprint;
    for (const update of updates) update();
    return true;
  };
  // CSSOM edits have no general mutation event. Preserve next-fact sampling
  // through the existing native bridge, including window pointerup/blur and
  // current-link changes. Sample immediately, then once at the microtask tail
  // if later facts were coalesced: a handler may edit CSSOM and focus another
  // owner synchronously. Initial facts still use only the pre-write snapshot.
  let factsSampled = false;
  let factsNeedRefresh = false;
  const sampleFactsTheme = () => {
    if (initializing || !batchAlive) return false;
    if (factsSampled) {
      factsNeedRefresh = true;
      return false;
    }
    factsSampled = true;
    queueMicrotask(() => {
      const needsRefresh = factsNeedRefresh;
      factsNeedRefresh = false;
      factsSampled = false;
      if (needsRefresh) refreshTheme();
    });
    return refreshTheme();
  };
  const releases: Array<() => void> = [];
  // One passive public family Surface per TOC, sharing this batch's theme.
  // The native TOC owner alone measures and moves its aria-hidden mount.
  for (const range of ranges) {
    let family = batchFamily;
    let surface = document.createElement(`wc-site-${family}-surface`);
    const props = () => ({
      variant: 'muted',
      radius: family === 'brutalist' ? 'default' : 'md',
      border: 'none',
      elevation: 'none',
      surfaceStyle: {
        ...batchTheme,
        display: 'block',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      },
    });
    const apply = () => {
      const target = surface as HTMLElement & {
        setProps?: (props: Record<string, unknown>) => void;
      };
      if (target.isConnected && target.setProps) target.setProps(props());
      else setElementProps(target, props());
    };
    apply();
    range.append(surface);
    range.setAttribute('data-toc-range-ready', '');
    const update = () => {
      if (family !== batchFamily) {
        const previous = surface;
        family = batchFamily;
        surface = document.createElement(`wc-site-${family}-surface`);
        apply();
        previous.replaceWith(surface);
      } else apply();
    };
    updates.add(update);
    const release = () => {
      updates.delete(update);
      bindings.delete(range);
      surface.remove();
      range.removeAttribute('data-toc-range-ready');
    };
    bindings.set(range, release);
    releases.push(release);
  }
  for (const link of links) {
    let alive = true;
    const appearance = siteLinkAppearance(link);
    let restoreCaption = () => {};
    let family = batchFamily;
    let surface = document.createElement(`wc-site-${family}-surface`);
    let texts: HTMLElement[] = [];
    // Original arrows and text regions remain separate flex items, in source
    // order. Wrapping an entire anchor would break pagination reversal and
    // sidebar label/badge alignment even if the accessible name survived.
    const content = Array.from(link.childNodes);
    const composeContent = () => {
      surface.dataset.siteLinkContent = '';
      registerNativeContentContainer(surface, content);
      texts = [];
      for (const node of content) {
        if (
          (node.nodeType === 1 &&
            (node as Element).namespaceURI === 'http://www.w3.org/2000/svg') ||
          (node.nodeType === 3 && !node.textContent?.trim())
        ) {
          surface.append(node);
        } else {
          const text = document.createElement(`wc-site-${family}-text`);
          text.dataset.siteLinkText = '';
          registerNativeContentContainer(text, [node]);
          text.append(node);
          surface.append(text);
          texts.push(text);
        }
      }
    };
    link.classList.add('site-native-link');
    link.dataset.siteLinkEnhanced = 'true';
    link.dataset.siteLinkAppearance = appearance;
    link.dataset.siteNativeLink = '';
    link.removeAttribute('data-slot');
    link.removeAttribute('data-site-native-button');
    let facts = { hovered: false, pressed: false, focusVisible: false, current: false };
    let initialized = false;
    let propsRevision = 0;
    const applyProps = () => {
      const theme = batchTheme;
      const props = {
        ...linkSurfaceProps(family, appearance, siteLinkEmphasis(link), facts),
        surfaceStyle: {
          ...theme,
          ...linkSurfaceLayout(family, appearance, siteLinkEmphasis(link), facts),
        },
      };
      const textProps = {
        ...linkTextProps(appearance, facts, family),
        surfaceStyle: { ...theme, minWidth: '0' },
      };
      const owner = surface;
      const revision = ++propsRevision;
      const ownsSnapshot = () => alive && surface === owner && propsRevision === revision;
      const targets: Array<
        [
          HTMLElement & { setProps?: (props: Record<string, unknown>) => void },
          Record<string, unknown>,
        ]
      > = [
        [surface, props],
        ...texts.map((text): [HTMLElement, Record<string, unknown>] => [text, textProps]),
      ];
      for (const [target, next] of targets) {
        // A real setter may synchronously publish newer native facts, replace
        // this family or release the binding. Never continue its stale batch.
        if (!ownsSnapshot()) return () => {};
        // Pre-connected raw props are consumed by the Adapter's first mount.
        // Existing instances use the public setter once: it also updates the
        // controller, so a separate raw write plus replay would repeat styles.
        if (target.isConnected && typeof target.setProps === 'function') target.setProps(next);
        else setElementProps(target, next);
      }
      return () => {
        if (!ownsSnapshot()) return;
        // Normal registered elements expose setProps synchronously on connect.
        // Retain a bounded upgrade fallback only when that method is missing,
        // and never replay a retired family, binding or superseded snapshot.
        for (const [target, next] of targets) {
          if (typeof target.setProps === 'function') continue;
          queueMicrotask(() => {
            if (ownsSnapshot() && target.isConnected) target.setProps?.(next);
          });
        }
      };
    };
    const update = () => {
      if (!alive || !initialized) return;
      if (batchFamily !== family) {
        const previous = surface;
        family = batchFamily;
        surface = document.createElement(`wc-site-${family}-surface`);
        let replayPending = () => {};
        withNativeContentLease(link, () => {
          composeContent();
          replayPending = applyProps();
          previous.replaceWith(surface);
        });
        replayPending();
      } else applyProps()();
    };
    updates.add(update);
    const unbind = bindNativeLinkFacts(link, (next) => {
      facts = next;
      // A changed theme already broadcasts this owner's latest facts.
      if (!sampleFactsTheme()) update();
    });
    let replayPending = () => {};
    try {
      withNativeContentLease(link, () => {
        restoreCaption = preparePaginationCaption(link);
        composeContent();
        replayPending = applyProps();
        link.append(surface);
      });
      initialized = true;
      replayPending();
    } catch (error) {
      updates.delete(update);
      alive = false;
      unbind();
      throw error;
    }
    const release = () => {
      if (!alive) return;
      // The fact bridge clears its contribution before the binding is torn
      // down; no queued replay may modify the new page/generation afterwards.
      updates.delete(update);
      unbind();
      alive = false;
      bindings.delete(link);
      withNativeContentLease(link, () => {
        restoreCaption();
        if (surface.parentElement === link) {
          surface.replaceWith(...content);
          delete link.dataset.siteLinkEnhanced;
        }
      });
    };
    bindings.set(link, release);
    releases.push(release);
  }
  initializing = false;
  const observer = new view.MutationObserver(refreshTheme);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style', 'data-site-library-family'],
  });
  const media = view.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', refreshTheme);
  return () => {
    if (!batchAlive) return;
    batchAlive = false;
    observer.disconnect();
    media?.removeEventListener?.('change', refreshTheme);
    for (const release of releases) release();
    updates.clear();
  };
}
