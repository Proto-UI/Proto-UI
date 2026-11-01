/** Application-owned navigation disclosure. Button owns command activation;
 * the website owns navigation visibility, ARIA relationships and return focus. */
import { closeSiteSelects } from './site-select-dismissal';
export interface SiteHeaderDisclosure {
  bindButton(button: HTMLElement): () => void;
  enhance(): void;
  toggle(): void;
  close(restoreFocus?: boolean): void;
  destroy(): void;
}

const SITE_HEADER_OPEN_EVENT = 'site-header:disclosure-open';
const SITE_CONTENTS_OPEN_EVENT = 'site-contents:open';
const disclosures = new WeakMap<HTMLElement, SiteHeaderDisclosure>();
const contentsNavigations = new WeakMap<HTMLElement, SiteContentsNavigation>();
const FOCUSABLE = 'a[href], button, [role="button"], [role="combobox"], [tabindex="0"]';

/** Resolve escaped Select ownership through this disclosure's own IDREFs.
 * The caller chooses the eligible triggers; unrelated portals are never inside. */
function ownsSelectPopupForRoot(
  root: HTMLElement | null,
  target: Element | null,
  triggerSelector = '[aria-controls]'
): boolean {
  const popup = target?.closest('[role="listbox"], [data-site-select-content]');
  if (!root || !popup?.id) return false;
  return [...root.querySelectorAll(triggerSelector)].some((trigger) =>
    trigger.getAttribute('aria-controls')?.split(/\s+/).includes(popup.id)
  );
}

export function initSiteHeaderDisclosure(root: HTMLElement): SiteHeaderDisclosure {
  const existing = disclosures.get(root);
  if (existing) return existing;
  const document = root.ownerDocument;
  const window = document.defaultView;
  const panel = root.querySelector<HTMLElement>('[data-site-header-panel]');
  const navigation = root.querySelector<HTMLElement>('[data-site-header-navigation]');
  const desktopNavigation = root.querySelector<HTMLElement>(
    '[data-site-header-desktop-navigation]'
  );
  const settings = root.querySelector<HTMLElement>('[data-site-header-settings]');
  const preferences = root.querySelector<HTMLElement>('[data-site-header-preferences]');
  const compactContext = root.querySelector<HTMLElement>('[data-site-header-compact-context]');
  const originalPreferencesParent = preferences?.parentElement;
  const originalPreferencesNext = preferences?.nextSibling ?? null;
  const preferencesParent =
    root.querySelector<HTMLElement>('[data-site-header-wide-preferences]') ??
    originalPreferencesParent;
  const preferencesNext =
    originalPreferencesParent === preferencesParent
      ? originalPreferencesNext
      : (preferencesParent?.firstChild ?? null);
  const compact = window?.matchMedia('(max-width: 47.999rem)');
  const buttons = new Set<HTMLElement>();
  const buttonLeases = new Map<HTMLElement, { observer: MutationObserver | null }>();
  let pendingPositionFrame: number | null = null;
  let enhanced = false;
  let open = false;
  const nativePanel = panel?.localName === 'details' ? (panel as HTMLDetailsElement) : null;
  let destroyed = false;
  // Docs offsets follow the actual header, including font enlargement and
  // wrapped values. The existing disclosure owns this one measurement source.
  const frame = root.hasAttribute('data-docs-site-header')
    ? root.closest<HTMLElement>('.site-page-frame')
    : null;
  const originalHeight = frame?.style.getPropertyValue('--header-height') ?? '';
  const originalHeightPriority = frame?.style.getPropertyPriority('--header-height') ?? '';
  let measuredHeight: string | null = null;
  const measureHeader = () => {
    if (destroyed || !enhanced || !frame || !root.isConnected) return;
    // offsetHeight is a layout pixel measurement; CSS zoom must not be applied
    // twice when this value is later consumed by a positioned descendant.
    const height = root.offsetHeight;
    if (!Number.isFinite(height) || height <= 0) return;
    const next = `${height}px`;
    if (frame.style.getPropertyValue('--header-height') === next) return;
    frame.style.setProperty('--header-height', next);
    measuredHeight = next;
  };
  const activeButton = () =>
    [...buttons].find((button) => {
      const generation = button.closest<HTMLElement>('[data-projection-generation-state]');
      return (
        button.isConnected &&
        (!generation || generation.dataset.projectionGenerationState === 'active')
      );
    });
  const movePreferences = (compactLayout: boolean) => {
    if (!preferences || !preferencesParent || !compactContext) return;
    const parent = compactLayout ? compactContext : preferencesParent;
    if (preferences.parentElement === parent) return;
    // Move the complete mount owner, never its renderer-created children. In
    // particular, both homepage Selects retain one owner and one set of IDs.
    parent.insertBefore(
      preferences,
      !compactLayout && preferencesNext?.parentNode === parent ? preferencesNext : null
    );
  };
  const panelProperties = [
    '--site-header-panel-left',
    '--site-header-panel-top',
    '--site-header-panel-max-width',
    '--site-header-panel-max-height',
  ];
  const positionPanel = () => {
    const button = activeButton();
    if (destroyed || !enhanced || !open || !panel || !button || !window) return;
    const anchor = button.getBoundingClientRect();
    const header = root.getBoundingClientRect();
    if (anchor.width <= 0 || header.width <= 0) return;
    // Rects include zoom/transforms; absolute offsets use the containing block's
    // layout pixels. Use the actual current Button, not the header's far edge.
    const scaleX = root.offsetWidth > 0 ? header.width / root.offsetWidth : 1;
    const scaleY = root.offsetHeight > 0 ? header.height / root.offsetHeight : scaleX;
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
    const rightEdge = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - 8;
    const bottomEdge = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8;
    const rtl = window.getComputedStyle(root).direction === 'rtl';
    const mobile = !!compact?.matches;
    const availableWidth = mobile
      ? rightEdge - leftEdge
      : Math.max(0, rtl ? rightEdge - anchor.left : anchor.right - leftEdge);
    // A mobile navigation panel belongs below the complete header, independent
    // of the trigger's hover translation or wrapped toolbar rows.
    const top = (mobile ? header.bottom : anchor.bottom) + 5 * scaleY;
    const values: Record<string, string> = {
      '--site-header-panel-max-width': `${Math.max(0, Math.min(rightEdge - leftEdge, availableWidth)) / scaleX}px`,
      '--site-header-panel-top': `${(top - header.top) / scaleY - root.clientTop}px`,
      '--site-header-panel-max-height': `${Math.max(0, bottomEdge - top) / scaleY}px`,
    };
    for (const [name, value] of Object.entries(values))
      if (panel.style.getPropertyValue(name) !== value) panel.style.setProperty(name, value);
    const width = panel.getBoundingClientRect().width;
    const aligned = mobile ? leftEdge : rtl ? anchor.left : anchor.right - width;
    const left = Math.max(leftEdge, Math.min(aligned, rightEdge - width));
    const value = `${(left - header.left) / scaleX - root.clientLeft}px`;
    if (panel.style.getPropertyValue('--site-header-panel-left') !== value)
      panel.style.setProperty('--site-header-panel-left', value);
  };
  const measureLayout = () => {
    measureHeader();
    positionPanel();
  };
  const schedulePosition = () => {
    if (destroyed || !open || pendingPositionFrame !== null) return;
    if (!window?.requestAnimationFrame) return positionPanel();
    pendingPositionFrame = window.requestAnimationFrame(() => {
      pendingPositionFrame = null;
      positionPanel();
    });
  };
  const geometryObserver =
    typeof window?.ResizeObserver === 'function'
      ? new window.ResizeObserver((entries) => {
          // Panel content/scroll extent can change independently of the toolbar.
          // It never supplies the sticky Header height or creates a feedback loop.
          if (!entries || entries.some((entry) => entry.target === root)) measureHeader();
          positionPanel();
        })
      : null;
  geometryObserver?.observe(root);
  if (panel) geometryObserver?.observe(panel);
  window?.addEventListener('resize', measureLayout);
  window?.addEventListener('scroll', positionPanel, true);
  window?.visualViewport?.addEventListener('resize', positionPanel);
  window?.visualViewport?.addEventListener('scroll', positionPanel);
  const sync = () => {
    const focused = document.activeElement as HTMLElement | null;
    const focusInPreferences = !!focused && !!preferences?.contains(focused);
    const compactLayout = enhanced && !!compact?.matches;
    // A breakpoint cannot hide the settings currently being used, including a
    // portaled Select. Preserve that interaction by revealing its destination.
    if (
      compactLayout &&
      preferences?.parentElement !== compactContext &&
      (focusInPreferences || ownsSelectPopup(focused))
    )
      open = true;
    root.dataset.siteMenuOpen = String(open);
    root.toggleAttribute('data-site-menu-ready', enhanced);
    if (desktopNavigation) desktopNavigation.hidden = !!compact?.matches;
    if (navigation) navigation.hidden = !compact?.matches || (enhanced && !open);
    if (panel) panel.hidden = enhanced && !open;
    if (settings) settings.hidden = enhanced && !open;
    if (enhanced) movePreferences(compactLayout);
    if (focusInPreferences && focused?.isConnected && !focused.closest('[hidden], [inert]'))
      focused.focus({ preventScroll: true });
    for (const button of buttons) {
      button.setAttribute('aria-expanded', String(open));
      if (panel?.id) button.setAttribute('aria-controls', panel.id);
    }
    measureLayout();
  };
  const close = (restoreFocus = false) => {
    if (!open || destroyed) return;
    const focused = document.activeElement;
    const hidingFocus = !!focused && (!!panel?.contains(focused) || ownsSelectPopup(focused));
    if (panel) closeSiteSelects(panel, 'parent.dismiss');
    open = false;
    sync();
    if (restoreFocus || hidingFocus) activeButton()?.focus({ preventScroll: true });
  };
  const ownsSelectPopup = (target: Element | null) => ownsSelectPopupForRoot(root, target);
  const nestedEscape = new WeakSet<KeyboardEvent>();
  const captureEscapeOwner = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open) return;
    // Read ownership before the nested Select handles and closes this sample.
    // Its delayed initial focus may still be on its trigger.
    const nestedOpen = [...root.querySelectorAll('[aria-controls][aria-expanded="true"]')].some(
      (trigger) =>
        trigger
          .getAttribute('aria-controls')
          ?.split(/\s+/)
          .some((id) => {
            const popup = document.getElementById(id);
            return (
              popup?.matches('[role="listbox"], [data-site-select-content]') &&
              !popup.closest('[hidden], [inert]')
            );
          })
    );
    if (nestedOpen) nestedEscape.add(event);
  };
  const onEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !open || nestedEscape.has(event))
      return;
    // A Select or another nested overlay owns its own Escape first.
    const target = event.target instanceof (window?.Element ?? Element) ? event.target : null;
    if (ownsSelectPopup(target) || target?.closest('[role="dialog"]')) return;
    event.preventDefault();
    close(true);
  };
  const onOutside = (event: Event) => {
    if (!open) return;
    const target = event.target instanceof (window?.Element ?? Element) ? event.target : null;
    if (!target || root.contains(target)) return;
    // Header Select popups are portaled. Do not dismiss their parent disclosure.
    if (ownsSelectPopup(target)) return;
    close();
  };
  const onNavigation = (event: Event) => {
    const link = (event.target as Element | null)?.closest('a[href]');
    if (link && panel?.contains(link)) close();
  };
  const onBreakpoint = () => {
    const focused = document.activeElement;
    sync();
    if (
      focused &&
      [navigation, desktopNavigation].some((region) => region?.hidden && region.contains(focused))
    )
      activeButton()?.focus();
  };
  const onContentsOpen = () => close();
  // Do not create a history entry for a non-modal disclosure. Real browser
  // Back/Forward (including a restored bfcache page) must never resurrect it.
  const onHistory = () => {
    const focused = document.activeElement;
    const popup = focused?.closest('[role="listbox"], [data-site-select-content]');
    const trigger = popup?.id
      ? [...root.querySelectorAll<HTMLElement>('[aria-controls]')].find((item) =>
          item.getAttribute('aria-controls')?.split(/\s+/).includes(popup.id)
        )
      : undefined;
    const wasOpen = open;
    closeSiteSelects(root, 'history');
    close(!!trigger);
    if (!wasOpen && trigger?.isConnected && !trigger.closest('[hidden], [inert]'))
      trigger.focus({ preventScroll: true });
  };
  // Initial pageshow can follow delayed module enhancement. Only bfcache
  // restoration is history navigation; it must not erase native startup intent.
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) onHistory();
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (pendingPositionFrame !== null) window?.cancelAnimationFrame(pendingPositionFrame);
    pendingPositionFrame = null;
    for (const lease of buttonLeases.values()) lease.observer?.disconnect();
    buttonLeases.clear();
    geometryObserver?.disconnect();
    window?.removeEventListener('resize', measureLayout);
    window?.removeEventListener('scroll', positionPanel, true);
    window?.visualViewport?.removeEventListener('resize', positionPanel);
    window?.visualViewport?.removeEventListener('scroll', positionPanel);
    // Restore the authored native disclosure owner, which may already be
    // compact in SSR. Do not leave a second row behind after teardown.
    if (preferences && originalPreferencesParent)
      originalPreferencesParent.insertBefore(
        preferences,
        originalPreferencesNext?.parentNode === originalPreferencesParent
          ? originalPreferencesNext
          : null
      );
    for (const property of panelProperties) panel?.style.removeProperty(property);
    if (
      frame &&
      measuredHeight !== null &&
      frame.style.getPropertyValue('--header-height') === measuredHeight &&
      frame.style.getPropertyPriority('--header-height') === ''
    ) {
      if (originalHeight)
        frame.style.setProperty('--header-height', originalHeight, originalHeightPriority);
      else frame.style.removeProperty('--header-height');
    }
    compact?.removeEventListener('change', onBreakpoint);
    document.removeEventListener('keydown', captureEscapeOwner, true);
    document.removeEventListener('keydown', onEscape);
    document.removeEventListener('pointerdown', onOutside);
    document.removeEventListener(SITE_CONTENTS_OPEN_EVENT, onContentsOpen);
    window?.removeEventListener('popstate', onHistory);
    window?.removeEventListener('pageshow', onPageShow);
    document.removeEventListener('astro:before-swap', destroy);
    panel?.removeEventListener('click', onNavigation);
    buttons.clear();
    if (navigation) navigation.hidden = false;
    if (desktopNavigation) desktopNavigation.hidden = false;
    if (panel) panel.hidden = false;
    if (nativePanel) nativePanel.open = open;
    if (settings) settings.hidden = false;
    root.removeAttribute('data-site-menu-ready');
    root.removeAttribute('data-site-menu-open');
    disclosures.delete(root);
  };
  const handle: SiteHeaderDisclosure = {
    bindButton(button) {
      if (destroyed) return () => {};
      buttonLeases.get(button)?.observer?.disconnect();
      const lease = {
        observer: window?.MutationObserver ? new window.MutationObserver(schedulePosition) : null,
      };
      buttonLeases.set(button, lease);
      buttons.add(button);
      geometryObserver?.observe(button);
      // Prototype hover/press translations do not trigger ResizeObserver. Read
      // the resulting actual box once per frame without a permanent RAF loop.
      lease.observer?.observe(button, {
        attributes: true,
        attributeFilter: [
          'data-hovered',
          'data-pressed',
          'data-focused',
          'data-focus-visible',
          'data-pui-style',
          'style',
          'class',
        ],
      });
      sync();
      return () => {
        lease.observer?.disconnect();
        if (buttonLeases.get(button) !== lease) return;
        buttonLeases.delete(button);
        buttons.delete(button);
        geometryObserver?.unobserve(button);
      };
    },
    enhance() {
      if (destroyed) return;
      const summaryFocused =
        !enhanced && !!nativePanel?.querySelector('summary')?.contains(document.activeElement);
      if (!enhanced && nativePanel) {
        // The browser owns initial disclosure while code loads or fails. Adopt
        // its state once; the existing application controller then takes over.
        open = nativePanel.open;
        nativePanel.open = true;
      }
      enhanced = true;
      sync();
      if (summaryFocused) activeButton()?.focus({ preventScroll: true });
    },
    toggle() {
      if (destroyed || !enhanced) return;
      if (open) {
        close(true);
        return;
      }
      open = true;
      sync();
      if (open) {
        document.dispatchEvent(new CustomEvent(SITE_HEADER_OPEN_EVENT));
        queueMicrotask(() => {
          if (!open || destroyed) return;
          const region = panel;
          const target = [...(region?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].find(
            (element) => !element.closest('[hidden], [inert]')
          );
          target?.focus();
        });
      }
    },
    close,
    destroy,
  };
  compact?.addEventListener('change', onBreakpoint);
  document.addEventListener('keydown', captureEscapeOwner, true);
  document.addEventListener('keydown', onEscape);
  document.addEventListener('pointerdown', onOutside);
  document.addEventListener(SITE_CONTENTS_OPEN_EVENT, onContentsOpen);
  window?.addEventListener('popstate', onHistory);
  window?.addEventListener('pageshow', onPageShow);
  document.addEventListener('astro:before-swap', destroy);
  panel?.addEventListener('click', onNavigation);
  disclosures.set(root, handle);
  return handle;
}

/** The application retains one directory-disclosure owner across replaceable
 * command views. The legacy host branch remains compatible with old consumers;
 * the Docs Header uses an ordinary app-owned host, with no upstream listener. */
/** A replaceable public Dialog view, not another open/focus/scroll owner. */
export interface SiteContentsPresentation {
  available(): boolean;
  setOpen(open: boolean): void;
  controlsId(): string | null;
}

export interface SiteContentsNavigation {
  bindButton(button: HTMLElement, active: () => boolean, focus: () => void): () => void;
  bindPresentation(presentation: SiteContentsPresentation): () => void;
  toggle(): void;
  close(restoreFocus?: boolean): void;
  focus(): void;
  refresh(): void;
  destroy(): void;
}

export function siteContentsNavigation(document: Document): SiteContentsNavigation | undefined {
  const menuHost = document.querySelector<HTMLElement>(
    '[data-site-contents-command], starlight-menu-button'
  );
  const fallback = menuHost?.querySelector<HTMLButtonElement>(
    '[data-site-contents-fallback], button'
  );
  if (!menuHost || !fallback) return;
  const existing = contentsNavigations.get(menuHost);
  if (existing) return existing;
  const view = document.defaultView!;
  const appOwned = menuHost.hasAttribute('data-site-contents-command');
  const bindings = new Map<HTMLElement, { active(): boolean; focus(): void }>();
  bindings.set(fallback, {
    active: () => fallback.isConnected && !fallback.hidden && !fallback.inert && !fallback.disabled,
    focus: () => fallback.focus(),
  });
  let pendingFocus = false;
  const onFocus = () => {
    pendingFocus = false;
  };
  document.addEventListener('focusin', onFocus, true);
  let expanded = false;
  let destroyed = false;
  let presentation: SiteContentsPresentation | undefined;
  const focus = () => {
    if (destroyed) return;
    pendingFocus = true;
    for (const binding of bindings.values())
      if (binding.active()) {
        pendingFocus = false;
        return binding.focus();
      }
  };
  const syncExpandedState = () => {
    const next = menuHost.getAttribute('aria-expanded') === 'true';
    for (const button of bindings.keys()) {
      button.setAttribute('aria-expanded', String(next));
      button.setAttribute('aria-controls', presentation?.controlsId() || 'starlight__sidebar');
      if (presentation) button.setAttribute('aria-haspopup', 'dialog');
      else button.removeAttribute('aria-haspopup');
    }
    const newlyOpened = next && !expanded;
    const changed = next !== expanded;
    expanded = next;
    document.body.toggleAttribute('data-mobile-menu-expanded', next);
    document.body.toggleAttribute('data-site-contents-dialog', !!presentation);
    if (changed) presentation?.setOpen(next);
    if (newlyOpened) document.dispatchEvent(new view.CustomEvent(SITE_CONTENTS_OPEN_EVENT));
  };
  const collapseMenu = (restoreFocus = false) => {
    if (destroyed) return;
    const alreadyClosed = !expanded;
    menuHost.setAttribute('aria-expanded', 'false');
    document.body.removeAttribute('data-mobile-menu-expanded');
    syncExpandedState();
    if (alreadyClosed) presentation?.setOpen(false);
    // Public Dialog owns modal close/restore. The in-flow fallback retains its
    // old application command return, without a second modal focus policy.
    if (restoreFocus && !presentation) focus();
  };
  const toggle = () => {
    if (destroyed) return;
    const next = menuHost.getAttribute('aria-expanded') !== 'true';
    menuHost.setAttribute('aria-expanded', String(next));
    document.body.toggleAttribute('data-mobile-menu-expanded', next);
    syncExpandedState();
  };
  // A native fallback already supplies Enter/Space click synthesis. Enhanced
  // Buttons supply only their public outward activation through their view.
  const onFallback = (event: Event) => {
    if (!(event instanceof view.CustomEvent) && bindings.get(fallback)?.active()) toggle();
  };
  const desktopQuery = view.matchMedia('(min-width: 64rem)');
  const collapseOnDesktop = () => {
    if (desktopQuery.matches) collapseMenu();
  };
  const onHeaderOpen = () => collapseMenu();
  const onEscape = (event: KeyboardEvent) => {
    if (presentation || event.key !== 'Escape' || event.defaultPrevented || !expanded) return;
    event.preventDefault();
    collapseMenu(true);
  };
  const onOutside = (event: Event) => {
    if (presentation || !expanded || !(event.target instanceof view.Element)) return;
    const sidebar = document.getElementById('starlight__sidebar');
    if (
      menuHost.contains(event.target) ||
      sidebar?.contains(event.target) ||
      ownsSelectPopupForRoot(
        sidebar,
        event.target,
        '[role="combobox"][aria-expanded="true"][aria-controls]'
      )
    )
      return;
    collapseMenu();
  };
  const onNavigation = (event: Event) => {
    if (!(event.target instanceof view.Element) || event.defaultPrevented) return;
    if (
      event instanceof view.MouseEvent &&
      (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    )
      return;
    const link = event.target.closest<HTMLAnchorElement>('#starlight__sidebar a[href]');
    if (link && !link.download && (!link.target || link.target === '_self')) collapseMenu();
  };
  const onRouteChange = () => collapseMenu();
  const observer = new view.MutationObserver(syncExpandedState);
  observer.observe(menuHost, { attributes: true, attributeFilter: ['aria-expanded'] });
  const destroy = () => {
    if (destroyed) return;
    collapseMenu();
    destroyed = true;
    observer.disconnect();
    desktopQuery.removeEventListener('change', collapseOnDesktop);
    view.removeEventListener('popstate', onRouteChange);
    view.removeEventListener('hashchange', onRouteChange);
    fallback.removeEventListener('click', onFallback);
    document.removeEventListener(SITE_HEADER_OPEN_EVENT, onHeaderOpen);
    document.removeEventListener('keyup', onEscape);
    document.removeEventListener('pointerdown', onOutside);
    document.removeEventListener('click', onNavigation);
    document.removeEventListener('astro:before-swap', destroy);
    document.removeEventListener('focusin', onFocus, true);
    presentation = undefined;
    document.body.removeAttribute('data-site-contents-dialog');
    bindings.clear();
    contentsNavigations.delete(menuHost);
  };
  const handle: SiteContentsNavigation = {
    bindPresentation(next) {
      if (destroyed) return () => {};
      const previous = presentation;
      previous?.setOpen(false);
      presentation = next;
      next.setOpen(expanded);
      syncExpandedState();
      return () => {
        // An old generation must never retire its successor. A failed
        // publication may restore only a still-live previous view.
        if (presentation !== next) return;
        next.setOpen(false);
        presentation = previous?.available() ? previous : undefined;
        presentation?.setOpen(expanded);
        syncExpandedState();
      };
    },
    bindButton(button, active, focus) {
      if (destroyed) return () => {};
      const binding = { active, focus };
      bindings.set(button, binding);
      syncExpandedState();
      return () => {
        if (bindings.get(button) === binding) bindings.delete(button);
      };
    },
    toggle,
    close: collapseMenu,
    focus,
    refresh() {
      if (destroyed) return;
      syncExpandedState();
      if (pendingFocus) focus();
    },
    destroy,
  };
  if (appOwned) {
    fallback.addEventListener('click', onFallback);
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('click', onNavigation);
  }
  desktopQuery.addEventListener('change', collapseOnDesktop);
  view.addEventListener('popstate', onRouteChange);
  view.addEventListener('hashchange', onRouteChange);
  document.addEventListener(SITE_HEADER_OPEN_EVENT, onHeaderOpen);
  document.addEventListener('keyup', onEscape);
  document.addEventListener('astro:before-swap', destroy);
  contentsNavigations.set(menuHost, handle);
  syncExpandedState();
  collapseOnDesktop();
  return handle;
}

/** Retain the existing PageFrame initializer and its stable cleanup identity. */
export function initSiteContentsNavigation(document: Document): (() => void) | undefined {
  return siteContentsNavigation(document)?.destroy;
}
