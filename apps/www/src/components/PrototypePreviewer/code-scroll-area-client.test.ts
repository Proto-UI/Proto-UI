import { afterEach, expect, it, vi } from 'vitest';
import { readCopyText } from '../site-copy-client';
import { refreshCodePanel } from './code-panel-client';
import { codeScrollTarget, enhanceCodeScrollArea } from './code-scroll-area-client';

function sourcePanel(): HTMLElement {
  const shell = document.createElement('figure');
  shell.dataset.codeShell = '';
  shell.dataset.codeExpanded = 'true';
  shell.innerHTML = `<div data-code-inner><div data-code-scroll-root data-code-scroll-label="Source">
    <div data-code-content><pre class="proto-previewer__code" tabindex="0"><code data-raw-code="const style = '&lt;&amp;'">&#60;span&#62;</code></pre></div>
  </div></div>`;
  document.body.append(shell);
  return shell;
}

type Facts = HTMLElement & {
  getExposes(): Record<string, { get(): unknown }>;
};

afterEach(() => document.body.replaceChildren());

it('enhances the original highlighted node with real Shadcn dual-axis anatomy', async () => {
  const shell = sourcePanel();
  const pre = shell.querySelector('pre')!;
  expect(codeScrollTarget(shell)).toBe(pre);
  expect(pre.tabIndex).toBe(0);
  expect(readCopyText(shell)).toBe("const style = '<&'");

  await enhanceCodeScrollArea(shell);
  const viewport = shell.querySelector<Facts>('[data-code-scroll-viewport]')!;
  await vi.waitFor(() => expect(viewport.getExposes().scrollProjection.get()).toBe('composed'));
  expect(codeScrollTarget(shell)).toBe(viewport);
  expect(shell.querySelector('pre')).toBe(pre);
  expect(pre.hasAttribute('tabindex')).toBe(false);
  expect(viewport.getAttribute('aria-label')).toBe('Source');
  const tracks = [...shell.querySelectorAll<Facts>('[data-code-scroll-track]')];
  expect(tracks.map((track) => track.getExposes().orientation.get())).toEqual([
    'vertical',
    'horizontal',
  ]);
  expect(tracks.every((track) => track.querySelector('wc-site-code-scroll-thumb'))).toBe(true);

  viewport.scrollTop = viewport.scrollLeft = 40;
  shell.querySelector('[data-code-content]')!.innerHTML =
    '<pre class="proto-previewer__code" tabindex="0"><code data-raw-code="new code">new code</code></pre>';
  refreshCodePanel(shell, { reset: true });
  expect(shell.querySelector('[data-code-scroll-viewport]')).toBe(viewport);
  expect([viewport.scrollTop, viewport.scrollLeft]).toEqual([0, 0]);
  expect(shell.querySelector('pre')!.hasAttribute('tabindex')).toBe(false);
  expect(readCopyText(shell)).toBe('new code');
});

it('does not revive a removed panel while asynchronous enhancement resolves', async () => {
  const shell = sourcePanel();
  const pending = enhanceCodeScrollArea(shell);
  shell.remove();
  await pending;
  expect(shell.querySelector('[data-code-scroll-ready]')).toBeNull();
  expect(shell.querySelector('pre')!.tabIndex).toBe(0);
});

it('leaves a pre that received early keyboard focus untouched', async () => {
  const shell = sourcePanel();
  const pre = shell.querySelector('pre')!;
  pre.focus();
  await enhanceCodeScrollArea(shell);
  expect(document.activeElement).toBe(pre);
  expect(codeScrollTarget(shell)).toBe(pre);
  expect(shell.querySelector('[data-code-scroll-ready]')).toBeNull();
});
