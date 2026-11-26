import { codeScrollTarget, enhanceCodeScrollArea } from './code-scroll-area-client';
import { isSiteButtonActivation } from '../site-shadcn-controls';

export interface RefreshCodePanelOptions {
  readonly reset?: boolean;
}

const COLLAPSED_CLIP_EPSILON = 2;
const MIN_VISIBLE_PANEL_HEIGHT = 8;

function setCodeRegionInert(shell: HTMLElement, inert: boolean): void {
  const region =
    shell.querySelector<HTMLElement>('[data-code-scroll-root]') ??
    shell.querySelector<HTMLElement>('[data-code-content]');
  if (!region) return;
  if (inert) region.setAttribute('inert', '');
  else region.removeAttribute('inert');
  if ('inert' in region) region.inert = inert;
}

function setExpanded(shell: HTMLElement, expanded: boolean, canCollapse: boolean): void {
  shell.dataset.codeExpanded = String(expanded);
  shell.dataset.codeCanCollapse = String(canCollapse);
  const panel = shell.querySelector<HTMLElement>('[data-code-inner]');
  if (panel) panel.dataset.codeExpanded = String(expanded);
  setCodeRegionInert(shell, !expanded);
  const guard = shell.querySelector<HTMLElement>('[data-code-expand-guard]');
  if (guard) guard.hidden = expanded || !canCollapse;
  const toggle = shell.querySelector<HTMLElement>('[data-code-toggle]');
  toggle?.setAttribute('aria-expanded', String(expanded));
  if (toggle) toggle.hidden = expanded;
  const collapseBar = shell.querySelector<HTMLElement>('[data-code-collapse-bar]');
  const collapse = shell.querySelector<HTMLElement>('[data-code-collapse]');
  collapse?.setAttribute('aria-expanded', String(expanded));
  if (collapseBar) collapseBar.hidden = !expanded || !canCollapse;
  else if (collapse) collapse.hidden = !expanded || !canCollapse;
  const copyButton = shell.querySelector<HTMLElement>('[data-copy]');
  if (copyButton) copyButton.hidden = !expanded;
}

function resetCodeScroll(shell: HTMLElement): void {
  const scroller = codeScrollTarget(shell);
  if (scroller) {
    scroller.scrollLeft = 0;
    scroller.scrollTop = 0;
  }
}

export function refreshCodePanel(shell: HTMLElement, options: RefreshCodePanelOptions = {}): void {
  const panel = shell.querySelector<HTMLElement>('[data-code-inner]');
  const content = shell.querySelector<HTMLElement>('[data-code-content]');
  if (!panel || !content) return;
  const scroller = codeScrollTarget(shell);

  if (shell.dataset.codeCollapsible === 'false') {
    setExpanded(shell, true, false);
    return;
  }
  if (options.reset) {
    setExpanded(shell, false, true);
    // Runtime changes replace the pre, but keep the same viewport anatomy.
    if (scroller?.matches('[data-code-scroll-viewport]')) {
      scroller.scrollLeft = 0;
      scroller.scrollTop = 0;
    }
  }
  if (shell.dataset.codeExpanded === 'true') return;
  if (panel.getBoundingClientRect().height < MIN_VISIBLE_PANEL_HEIGHT) return;

  const fullHeight = scroller?.scrollHeight ?? content.scrollHeight;
  const visibleHeight = scroller?.matches('[data-code-scroll-viewport]')
    ? scroller.clientHeight
    : content.clientHeight;
  const fitsCollapsed = fullHeight <= visibleHeight + COLLAPSED_CLIP_EPSILON;
  setExpanded(shell, fitsCollapsed, !fitsCollapsed);
}

const panels = new Map<HTMLElement, () => void>();

function initCodePanel(shell: HTMLElement): void {
  if (panels.has(shell)) return;
  shell.dataset.codePanelInit = '1';
  const nonCollapsible = shell.dataset.codeCollapsible === 'false';
  setExpanded(shell, nonCollapsible, !nonCollapsible);
  const panel = shell.querySelector<HTMLElement>('[data-code-inner]');
  const guard = shell.querySelector<HTMLElement>('[data-code-expand-guard]');
  const toggle = shell.querySelector<HTMLElement>('[data-code-toggle]');
  const collapse = shell.querySelector<HTMLElement>('[data-code-collapse]');
  let alive = true;
  let first = 0;
  let second = 0;
  const view = shell.ownerDocument.defaultView!;
  const scheduleRefresh = () => {
    if (!alive) return;
    view.cancelAnimationFrame(first);
    view.cancelAnimationFrame(second);
    first = view.requestAnimationFrame(() => {
      second = view.requestAnimationFrame(() => {
        if (alive) refreshCodePanel(shell);
      });
    });
  };
  const onExpand = (event: Event) => {
    if (!isSiteButtonActivation(event)) return;
    const expanded = shell.dataset.codeExpanded !== 'true';
    const ownedFocus = !!toggle && toggle.contains(shell.ownerDocument.activeElement);
    setExpanded(shell, expanded, shell.dataset.codeCollapsible !== 'false');
    // The expansion Button is now hidden. Keep keyboard readers on the source
    // viewport so Arrow/Page keys scroll code and Shift+Tab reaches Copy.
    if (expanded && ownedFocus) codeScrollTarget(shell)?.focus({ preventScroll: true });
  };
  const onGuardClick = (event: MouseEvent) => {
    if (shell.dataset.codeExpanded === 'true') return;
    if (event.button !== 0) return;
    event.preventDefault();
    setExpanded(shell, true, shell.dataset.codeCollapsible !== 'false');
  };
  const onCollapse = (event: Event) => {
    if (!isSiteButtonActivation(event)) return;
    if (shell.dataset.codeExpanded !== 'true') return;
    const ownedFocus = !!collapse && collapse.contains(shell.ownerDocument.activeElement);
    resetCodeScroll(shell);
    setExpanded(shell, false, true);
    if (ownedFocus) toggle?.focus({ preventScroll: true });
  };
  toggle?.addEventListener('click', onExpand);
  guard?.addEventListener('click', onGuardClick);
  collapse?.addEventListener('click', onCollapse);
  const observer =
    panel && typeof view.ResizeObserver !== 'undefined'
      ? new view.ResizeObserver(scheduleRefresh)
      : null;
  if (panel) observer?.observe(panel);
  const dispose = () => {
    if (!alive) return;
    alive = false;
    panels.delete(shell);
    delete shell.dataset.codePanelInit;
    observer?.disconnect();
    removal.disconnect();
    view.cancelAnimationFrame(first);
    view.cancelAnimationFrame(second);
    toggle?.removeEventListener('click', onExpand);
    guard?.removeEventListener('click', onGuardClick);
    collapse?.removeEventListener('click', onCollapse);
    shell.ownerDocument.removeEventListener('astro:before-swap', dispose);
  };
  const removal = new view.MutationObserver(() => {
    if (!shell.isConnected) dispose();
  });
  removal.observe(shell.ownerDocument.body, { childList: true, subtree: true });
  shell.ownerDocument.addEventListener('astro:before-swap', dispose);
  panels.set(shell, dispose);
  if (shell.querySelector('[data-code-scroll-root]')) {
    void enhanceCodeScrollArea(shell).then(scheduleRefresh, () => {
      // An unavailable enhancement leaves the original native source usable.
    });
  }
  scheduleRefresh();
}

export function initCodePanels(root: ParentNode = document): void {
  if (root instanceof HTMLElement && root.matches('[data-code-shell]')) initCodePanel(root);
  root.querySelectorAll<HTMLElement>('[data-code-shell]').forEach(initCodePanel);
}
