import { isSiteButtonActivation } from '../site-shadcn-controls';

export interface RefreshCodePanelOptions {
  readonly reset?: boolean;
}

const COLLAPSED_CLIP_EPSILON = 2;
const MIN_VISIBLE_PANEL_HEIGHT = 8;

function setExpanded(shell: HTMLElement, expanded: boolean): void {
  shell.dataset.codeExpanded = String(expanded);
  const panel = shell.querySelector<HTMLElement>('[data-code-inner]');
  if (panel) panel.dataset.codeExpanded = String(expanded);
  const toggle = shell.querySelector<HTMLElement>('[data-code-toggle]');
  toggle?.setAttribute('aria-expanded', String(expanded));
  if (toggle) toggle.hidden = expanded;
  const copyButton = shell.querySelector<HTMLElement>('[data-copy]');
  if (copyButton) copyButton.hidden = !expanded;
}

export function refreshCodePanel(shell: HTMLElement, options: RefreshCodePanelOptions = {}): void {
  const panel = shell.querySelector<HTMLElement>('[data-code-inner]');
  const content = shell.querySelector<HTMLElement>('[data-code-content]');
  if (!panel || !content) return;

  if (options.reset) setExpanded(shell, false);
  if (shell.dataset.codeExpanded === 'true') return;
  if (panel.getBoundingClientRect().height < MIN_VISIBLE_PANEL_HEIGHT) return;

  const pre = content.querySelector<HTMLElement>('.proto-previewer__code');
  const fullHeight = pre?.scrollHeight ?? content.scrollHeight;
  setExpanded(shell, fullHeight <= content.clientHeight + COLLAPSED_CLIP_EPSILON);
}

const panels = new Map<HTMLElement, () => void>();

function initCodePanel(shell: HTMLElement): void {
  if (panels.has(shell)) return;
  shell.dataset.codePanelInit = '1';
  setExpanded(shell, false);
  const panel = shell.querySelector<HTMLElement>('[data-code-inner]');
  const toggle = shell.querySelector<HTMLElement>('[data-code-toggle]');
  let alive = true;
  let first = 0;
  let second = 0;
  const view = shell.ownerDocument.defaultView!;
  const scheduleRefresh = () => {
    view.cancelAnimationFrame(first);
    view.cancelAnimationFrame(second);
    first = view.requestAnimationFrame(() => {
      second = view.requestAnimationFrame(() => {
        if (alive) refreshCodePanel(shell);
      });
    });
  };
  const onToggle = (event: Event) => {
    if (!isSiteButtonActivation(event)) return;
    setExpanded(shell, shell.dataset.codeExpanded !== 'true');
  };
  toggle?.addEventListener('click', onToggle);
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
    toggle?.removeEventListener('click', onToggle);
    shell.ownerDocument.removeEventListener('astro:before-swap', dispose);
  };
  const removal = new view.MutationObserver(() => {
    if (!shell.isConnected) dispose();
  });
  removal.observe(shell.ownerDocument.body, { childList: true, subtree: true });
  shell.ownerDocument.addEventListener('astro:before-swap', dispose);
  panels.set(shell, dispose);
  scheduleRefresh();
}

export function initCodePanels(root: ParentNode = document): void {
  if (root instanceof HTMLElement && root.matches('[data-code-shell]')) initCodePanel(root);
  root.querySelectorAll<HTMLElement>('[data-code-shell]').forEach(initCodePanel);
}
