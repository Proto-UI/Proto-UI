import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCodePanels, refreshCodePanel } from './code-panel-client';

function panelMarkup(id: string, raw = 'const exact = "<&";'): string {
  const escaped = raw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<figure data-code-shell id="${id}">
    <div data-code-inner>
      <button type="button" data-copy aria-label="Copy code"><span data-copy-text>copy</span></button>
      <div data-code-content><pre class="proto-previewer__code"><code data-raw-code="${escaped}">${raw}</code></pre></div>
      <button type="button" data-code-toggle aria-expanded="false">View code</button>
    </div>
  </figure>`;
}

function setMeasurements(
  shell: HTMLElement,
  {
    panelHeight = 96,
    visibleHeight = 96,
    fullHeight,
  }: Readonly<{
    panelHeight?: number;
    visibleHeight?: number;
    fullHeight: number;
  }>
): void {
  const panel = shell.querySelector<HTMLElement>('[data-code-inner]')!;
  const content = shell.querySelector<HTMLElement>('[data-code-content]')!;
  const pre = shell.querySelector<HTMLElement>('.proto-previewer__code')!;
  panel.getBoundingClientRect = () =>
    ({
      height: panelHeight,
      width: 320,
      top: 0,
      left: 0,
      right: 320,
      bottom: panelHeight,
    }) as DOMRect;
  Object.defineProperty(content, 'clientHeight', { configurable: true, value: visibleHeight });
  Object.defineProperty(content, 'scrollHeight', { configurable: true, value: fullHeight });
  Object.defineProperty(pre, 'scrollHeight', { configurable: true, value: fullHeight });
}

describe('CodePanel client', () => {
  beforeEach(() => {
    document.body.innerHTML = panelMarkup('first');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('copies the exact raw source rather than highlighted text', async () => {
    const shell = document.querySelector<HTMLElement>('[data-code-shell]')!;
    setMeasurements(shell, { fullHeight: 48 });
    initCodePanels(document);
    shell.querySelector<HTMLButtonElement>('[data-copy]')!.click();
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const exact = "<&";');
  });

  it('auto-expands short content and keeps long content collapsed', () => {
    const short = document.querySelector<HTMLElement>('[data-code-shell]')!;
    setMeasurements(short, { fullHeight: 48 });
    initCodePanels(document);
    refreshCodePanel(short, { reset: true });
    expect(short.dataset.codeExpanded).toBe('true');
    expect(short.querySelector('[data-code-toggle]')?.getAttribute('aria-expanded')).toBe('true');

    document.body.insertAdjacentHTML('beforeend', panelMarkup('long', 'line\n'.repeat(80)));
    const long = document.querySelector<HTMLElement>('#long')!;
    setMeasurements(long, { fullHeight: 400 });
    initCodePanels(long);
    refreshCodePanel(long, { reset: true });
    expect(long.dataset.codeExpanded).toBe('false');
    expect(long.querySelector('[data-code-toggle]')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('defers hidden measurement until a direct visibility refresh', () => {
    const shell = document.querySelector<HTMLElement>('[data-code-shell]')!;
    setMeasurements(shell, { panelHeight: 0, fullHeight: 48 });
    initCodePanels(document);
    expect(shell.dataset.codeExpanded).toBe('false');
    setMeasurements(shell, { panelHeight: 96, fullHeight: 48 });
    refreshCodePanel(shell);
    expect(shell.dataset.codeExpanded).toBe('true');
  });

  it('preserves expansion independently while switching panels', () => {
    document.body.insertAdjacentHTML('beforeend', panelMarkup('second', 'line\n'.repeat(80)));
    const first = document.querySelector<HTMLElement>('#first')!;
    const second = document.querySelector<HTMLElement>('#second')!;
    setMeasurements(first, { fullHeight: 400 });
    setMeasurements(second, { fullHeight: 400 });
    initCodePanels(document);
    refreshCodePanel(first, { reset: true });
    refreshCodePanel(second, { reset: true });
    first.querySelector<HTMLButtonElement>('[data-code-toggle]')!.click();
    expect(first.dataset.codeExpanded).toBe('true');
    expect(second.dataset.codeExpanded).toBe('false');

    first.hidden = true;
    second.hidden = false;
    refreshCodePanel(second);
    first.hidden = false;
    refreshCodePanel(first);
    expect(first.dataset.codeExpanded).toBe('true');
    expect(second.dataset.codeExpanded).toBe('false');
  });

  it('resets measurement after Previewer replaces highlighted code', () => {
    const shell = document.querySelector<HTMLElement>('[data-code-shell]')!;
    setMeasurements(shell, { fullHeight: 400 });
    initCodePanels(document);
    refreshCodePanel(shell, { reset: true });
    shell.querySelector<HTMLButtonElement>('[data-code-toggle]')!.click();
    expect(shell.dataset.codeExpanded).toBe('true');

    shell.querySelector<HTMLElement>('[data-code-content]')!.innerHTML =
      '<pre class="proto-previewer__code"><code data-raw-code="replacement">replacement</code></pre>';
    setMeasurements(shell, { fullHeight: 400 });
    refreshCodePanel(shell, { reset: true });
    expect(shell.dataset.codeExpanded).toBe('false');
  });

  it('initializes each shell idempotently', () => {
    const shell = document.querySelector<HTMLElement>('[data-code-shell]')!;
    setMeasurements(shell, { fullHeight: 400 });
    initCodePanels(document);
    initCodePanels(document);
    shell.querySelector<HTMLButtonElement>('[data-code-toggle]')!.click();
    expect(shell.dataset.codePanelInit).toBe('1');
    expect(shell.dataset.codeExpanded).toBe('true');
  });
});
