export interface RefreshCodePanelOptions {
  readonly reset?: boolean;
}

const COLLAPSED_CLIP_EPSILON = 2;
const MIN_VISIBLE_PANEL_HEIGHT = 8;

function setExpanded(shell: HTMLElement, expanded: boolean): void {
  shell.dataset.codeExpanded = String(expanded);
  const panel = shell.querySelector<HTMLElement>('[data-code-inner]');
  if (panel) panel.dataset.codeExpanded = String(expanded);
  shell
    .querySelector<HTMLButtonElement>('[data-code-toggle]')
    ?.setAttribute('aria-expanded', String(expanded));
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

function scheduleRefresh(shell: HTMLElement): void {
  requestAnimationFrame(() => requestAnimationFrame(() => refreshCodePanel(shell)));
}

function initCodePanel(shell: HTMLElement): void {
  if (shell.dataset.codePanelInit === '1') return;
  shell.dataset.codePanelInit = '1';
  setExpanded(shell, false);

  const panel = shell.querySelector<HTMLElement>('[data-code-inner]');
  const toggle = shell.querySelector<HTMLButtonElement>('[data-code-toggle]');
  const copyButton = shell.querySelector<HTMLButtonElement>('[data-copy]');
  const copyText = shell.querySelector<HTMLElement>('[data-copy-text]');

  toggle?.addEventListener('click', () => {
    setExpanded(shell, shell.dataset.codeExpanded !== 'true');
  });

  if (copyButton && copyText) {
    const copyIconHtml = copyText.innerHTML;
    const checkIconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4.5"><path d="M20 6 9 17l-5-5"/></svg>`;
    copyButton.addEventListener('click', async () => {
      const code = shell.querySelector<HTMLElement>('.proto-previewer__code code');
      const text = code?.dataset.rawCode ?? code?.textContent ?? '';
      try {
        await navigator.clipboard.writeText(text);
        copyText.innerHTML = checkIconHtml;
        setTimeout(() => {
          copyText.innerHTML = copyIconHtml;
        }, 1500);
      } catch {
        copyText.innerHTML = copyIconHtml;
      }
    });
  }

  if (panel && typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => scheduleRefresh(shell));
    observer.observe(panel);
  }
  scheduleRefresh(shell);
}

export function initCodePanels(root: ParentNode = document): void {
  if (root instanceof HTMLElement && root.matches('[data-code-shell]')) initCodePanel(root);
  root.querySelectorAll<HTMLElement>('[data-code-shell]').forEach(initCodePanel);
}
