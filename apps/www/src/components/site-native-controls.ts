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
  sidebarTextSurfaceStyle,
  readingTocTextSurfaceStyle,
  type SidebarTextRole,
  type SiteLinkAppearance,
  type SiteLinkEmphasis,
} from './site-link-recipes';
import { type SiteLinkIcon } from '../prototypes/site-link-icons';
import { bindNativeLinkFacts } from './site-native-link-facts';
import { resolveSiteLibraryFamily, type SiteLibraryFamily } from './site-library-family';
import { resolveProjectionThemeSurfaceStyle } from './PrototypePreviewer/projection-theme';

const bindings = new WeakMap<HTMLElement, () => void>();

/** Read authored navigation hierarchy, never infer depth from the enhanced wrappers. */
export function siteSidebarTextRole(link: HTMLElement): SidebarTextRole | undefined {
  if (!link.closest('.sidebar-pane .top-level')) return undefined;
  if (link.localName !== 'summary') return 'row';
  return link.matches('.sidebar-pane .top-level ul summary') ? 'nested-group' : 'top-group';
}

/** Keep compact reading rows separate from the native mobile TOC variant. */
export function siteIsReadingToc(link: HTMLElement): boolean {
  return !!link.closest('.right-sidebar sl-toc') && !link.closest('.isMobile');
}

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
 * transaction; this small WC bridge is only for static documentation chrome.
 * The document bootstrap opts into progressive decoration; direct consumers
 * retain complete synchronous initialization. Each task moves one whole owner. */
export function initSiteNativeControls(
  scope: ParentNode = document,
  options: { progressive?: boolean } = {}
): () => void {
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
      'a[data-site-native-link], a[data-site-primary-nav-link], .sidebar-pane .top-level a[href], .sidebar-pane .top-level summary, .pagination-links a[href], sl-toc a[href]'
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
  const enhanceRange = (range: HTMLElement) => {
    let alive = true;
    let family = batchFamily;
    let surface = document.createElement(`wc-site-${family}-surface`);
    if (!batchAlive) return;
    let mountedSurface: HTMLElement | null = null;
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
      if (!alive) return false;
      const target = surface as HTMLElement & {
        setProps?: (props: Record<string, unknown>) => void;
      };
      if (target.isConnected && target.setProps) target.setProps(props());
      else setElementProps(target, props());
      return alive && surface === target;
    };
    const update = () => {
      if (!alive) return;
      if (family !== batchFamily) {
        const previous = surface;
        family = batchFamily;
        surface = document.createElement(`wc-site-${family}-surface`);
        if (!apply()) return;
        mountedSurface = surface;
        previous.replaceWith(surface);
      } else apply();
    };
    updates.add(update);
    const release = () => {
      if (!alive) return;
      alive = false;
      updates.delete(update);
      mountedSurface?.remove();
      surface.remove();
      range.removeAttribute('data-toc-range-ready');
      if (bindings.get(range) === release) bindings.delete(range);
    };
    bindings.set(range, release);
    releases.push(release);
    if (!apply()) return;
    mountedSurface = surface;
    range.append(surface);
    if (alive) range.setAttribute('data-toc-range-ready', '');
  };
  const prepareLink = (link: HTMLElement): (() => void) | undefined => {
    let alive = true;
    let releasing = false;
    const appearance = siteLinkAppearance(link);
    const readingToc = appearance === 'toc' && siteIsReadingToc(link);
    let restoreCaption = () => {};
    let family = batchFamily;
    let surface: HTMLElement | undefined;
    let mountedSurface: HTMLElement | null = null;
    let composing = false;
    let texts: HTMLElement[] = [];
    // Original arrows and text regions remain separate flex items, in source
    // order. Wrapping an entire anchor would break pagination reversal and
    // sidebar label/badge alignment even if the accessible name survived.
    let content: ChildNode[] = [];
    const composeContent = () => {
      const owner = surface;
      if (!owner) return;
      owner.dataset.siteLinkContent = '';
      registerNativeContentContainer(owner, content);
      texts = [];
      for (const node of content) {
        if (!alive || surface !== owner) return;
        if (
          (node.nodeType === 1 &&
            (node as Element).namespaceURI === 'http://www.w3.org/2000/svg') ||
          (node.nodeType === 3 && !node.textContent?.trim())
        ) {
          owner.append(node);
        } else {
          const text = document.createElement(`wc-site-${family}-text`);
          if (!alive || surface !== owner) return;
          text.dataset.siteLinkText = '';
          registerNativeContentContainer(text, [node]);
          text.append(node);
          if (!alive || surface !== owner) return;
          owner.append(text);
          if (!alive || surface !== owner) return;
          texts.push(text);
        }
      }
    };
    // The native bridge must also observe hover/press/focus while this owner
    // still uses its SSR fallback. Appearance classifies TOC in-view facts.
    link.dataset.siteLinkAppearance = appearance;
    let facts = { hovered: false, pressed: false, focusVisible: false, current: false };
    let initialized = false;
    let propsRevision = 0;
    const applyProps = () => {
      if (!surface) return () => {};
      const theme = batchTheme;
      const props = {
        ...linkSurfaceProps(family, appearance, siteLinkEmphasis(link), facts),
        surfaceStyle: {
          ...theme,
          ...linkSurfaceLayout(family, appearance, siteLinkEmphasis(link), facts, readingToc),
        },
      };
      const sidebarRole = siteSidebarTextRole(link);
      const textProps = {
        ...linkTextProps(appearance, facts, family, sidebarRole, readingToc),
        surfaceStyle: {
          ...theme,
          minWidth: '0',
          ...(sidebarRole ? sidebarTextSurfaceStyle(sidebarRole) : {}),
          ...(readingToc ? readingTocTextSurfaceStyle() : {}),
        },
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
      if (!alive || !initialized || !surface) return;
      if (batchFamily !== family) {
        const previous = surface;
        family = batchFamily;
        surface = document.createElement(`wc-site-${family}-surface`);
        const next = surface;
        let replayPending = () => {};
        withNativeContentLease(link, () => {
          if (!alive || surface !== next) return;
          composing = true;
          composeContent();
          if (!alive || surface !== next) return;
          replayPending = applyProps();
          if (!alive || surface !== next) return;
          mountedSurface = next;
          previous.replaceWith(next);
          composing = false;
        });
        replayPending();
      } else applyProps()();
    };
    updates.add(update);
    let unbind: (() => void) | undefined;
    const release = () => {
      if (!alive || releasing) return;
      releasing = true;
      // Keep the final native-fact withdrawal, then stop all stale props work
      // before restoring content, including a partially connected first move.
      updates.delete(update);
      try {
        unbind?.();
      } finally {
        alive = false;
        try {
          if (surface)
            withNativeContentLease(link, () => {
              restoreCaption();
              if (mountedSurface?.parentElement === link) mountedSurface.replaceWith(...content);
              else if (composing) link.append(...content);
              surface?.remove();
              delete link.dataset.siteLinkEnhanced;
            });
        } finally {
          if (bindings.get(link) === release) bindings.delete(link);
        }
      }
    };
    bindings.set(link, release);
    releases.push(release);
    unbind = bindNativeLinkFacts(link, (next) => {
      facts = next;
      // A changed theme already broadcasts this owner's latest facts.
      if (!sampleFactsTheme()) update();
    });
    if (!alive) {
      unbind();
      return;
    }
    return () => {
      if (!alive) return;
      family = batchFamily;
      surface = document.createElement(`wc-site-${family}-surface`);
      if (!alive) return;
      content = Array.from(link.childNodes);
      link.classList.add('site-native-link');
      link.dataset.siteLinkEnhanced = 'true';
      link.dataset.siteNativeLink = '';
      link.removeAttribute('data-slot');
      link.removeAttribute('data-site-primary-nav-link');
      let replayPending = () => {};
      let preparedTheme = batchTheme;
      let preparedFacts = facts;
      withNativeContentLease(link, () => {
        if (!alive) return;
        composing = true;
        restoreCaption = preparePaginationCaption(link);
        if (!alive) {
          restoreCaption();
          return;
        }
        composeContent();
        if (!alive || !surface) return;
        preparedTheme = batchTheme;
        preparedFacts = facts;
        replayPending = applyProps();
        if (!alive) return;
        mountedSurface = surface;
        link.append(surface);
        composing = false;
      });
      if (!alive) return;
      initialized = true;
      replayPending();
      if (family !== batchFamily || preparedTheme !== batchTheme || preparedFacts !== facts)
        update();
    };
  };
  const observer = new view.MutationObserver(refreshTheme);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style', 'data-site-library-family'],
  });
  const media = view.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', refreshTheme);
  const targets = [...ranges, ...links];
  const initializeLinks: Array<() => void> = [];
  let cursor = 0;
  let pendingTask: number | undefined;
  const usesIdle = typeof view.requestIdleCallback === 'function';
  const releaseBatch = () => {
    if (!batchAlive) return;
    batchAlive = false;
    if (pendingTask !== undefined) {
      if (usesIdle) view.cancelIdleCallback(pendingTask);
      else view.clearTimeout(pendingTask);
      pendingTask = undefined;
    }
    observer.disconnect();
    media?.removeEventListener?.('change', refreshTheme);
    let failure: { error: unknown } | undefined;
    for (const release of releases) {
      try {
        release();
      } catch (error) {
        failure ??= { error };
      }
    }
    for (const target of targets)
      if (bindings.get(target) === releaseBatch) bindings.delete(target);
    updates.clear();
    if (failure) throw failure.error;
  };
  // Claim the complete population before any connection callback or task can
  // reenter initialization. A duplicate never takes pending or active owners.
  for (const target of targets) bindings.set(target, releaseBatch);
  const initializeNext = () => {
    const index = cursor++;
    const target = targets[index]!;
    if (options.progressive && (!target.isConnected || target.ownerDocument !== document)) {
      const release = bindings.get(target);
      if (release === releaseBatch) bindings.delete(target);
      else release?.();
      return;
    }
    initializing = true;
    try {
      if (index < ranges.length) enhanceRange(target);
      else initializeLinks[index - ranges.length]!();
    } finally {
      initializing = false;
    }
  };
  const scheduleNext = () => {
    if (!batchAlive || cursor === targets.length) return;
    pendingTask = usesIdle
      ? view.requestIdleCallback(continueInitialization)
      : view.setTimeout(continueInitialization, 0);
  };
  const continueInitialization = () => {
    pendingTask = undefined;
    if (!batchAlive) return;
    try {
      // A different family, media preference or CSSOM palette may have become
      // current while this owner was waiting. Sample before its first write.
      refreshTheme();
      if (batchAlive) initializeNext();
    } catch (error) {
      try {
        releaseBatch();
      } finally {
        throw error;
      }
    }
    scheduleNext();
  };
  try {
    for (const link of links) {
      const initialize = prepareLink(link);
      if (!batchAlive) break;
      initializeLinks.push(initialize!);
    }
    initializing = false;
    if (options.progressive) scheduleNext();
    else while (batchAlive && cursor < targets.length) initializeNext();
  } catch (error) {
    try {
      releaseBatch();
    } finally {
      throw error;
    }
  }
  return releaseBatch;
}
