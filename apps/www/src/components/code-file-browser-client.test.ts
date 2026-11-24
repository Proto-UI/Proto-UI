import { afterEach, expect, it, vi } from 'vitest';
import { initCodeFileBrowsers, initStandaloneCodeFileBrowsers } from './code-file-browser-client';
afterEach(() => {
  document.dispatchEvent(new Event('astro:before-swap'));
  document.body.replaceChildren();
  document.documentElement.scrollTop = 0;
  vi.restoreAllMocks();
});
function fixture() {
  document.body.innerHTML = `<section data-standalone-file-browser data-code-file-browser><nav data-code-file-tabs aria-label="Files">
    <span data-code-directory-path="proto-ui"></span><span data-code-directory-path="proto-ui/empty"></span>
    <a href="#config" id="config-link" aria-controls="config" data-code-file-tab data-code-file-path="proto-ui/config.json" data-code-file-selected="true">config.json</a>
    <a href="#css" id="css-link" aria-controls="css" data-code-file-tab data-code-file-path="src/style.css">style.css</a>
    </nav><figure id="config" data-code-file-panel aria-labelledby="config-link"><pre>config exact</pre></figure>
    <figure id="css" data-code-file-panel aria-labelledby="css-link" hidden><pre>css exact</pre></figure></section>`;
}
it('selects real files without host preference coupling or source replacement, and cleans up', async () => {
  fixture();
  const sources = [...document.querySelectorAll('pre')];
  initStandaloneCodeFileBrowsers();
  initStandaloneCodeFileBrowsers();
  expect(document.querySelectorAll('[role="tree"]')).toHaveLength(1);
  const tree = document.querySelector('[role="tree"]')!;
  tree.dispatchEvent(new CustomEvent('valueChange', { detail: { value: 'src/style.css' } }));
  await Promise.resolve();
  expect(document.querySelector<HTMLElement>('#css')!.hidden).toBe(false);
  expect(document.querySelector<HTMLElement>('#config')!.hidden).toBe(true);
  expect([...document.querySelectorAll('pre')]).toEqual(sources);
  document.dispatchEvent(new Event('astro:before-swap'));
  expect(document.querySelector('[role="tree"]')).toBeNull();
  expect(document.querySelector<HTMLElement>('nav')!.hidden).toBe(false);
  expect(
    [...document.querySelectorAll<HTMLElement>('figure')].every((panel) => !panel.hidden)
  ).toBe(true);
});
it('selects the declared source when file links are reordered independently of panels', () => {
  fixture();
  const list = document.querySelector('nav')!;
  list.prepend(document.querySelector('#css-link')!);
  initStandaloneCodeFileBrowsers();
  const tree = document.querySelector('[role="tree"]')!;
  tree.dispatchEvent(new CustomEvent('valueChange', { detail: { value: 'src/style.css' } }));
  expect(document.querySelector<HTMLElement>('#css')!.hidden).toBe(false);
  expect(document.querySelector<HTMLElement>('#config')!.hidden).toBe(true);
  expect(document.querySelector('#css')!.getAttribute('aria-labelledby')).toBe('css-link-tree');
});

it('keeps every source reachable if real Tree admission fails', () => {
  fixture();
  const get = Element.prototype.getAttribute;
  vi.spyOn(Element.prototype, 'getAttribute').mockImplementation(function (
    this: Element,
    name: string
  ) {
    return name === 'role' && this.localName.endsWith('tree-item') ? null : get.call(this, name);
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  initStandaloneCodeFileBrowsers();
  expect(document.querySelector('[role="tree"]')).toBeNull();
  expect(document.querySelector<HTMLElement>('nav')!.hidden).toBe(false);
  expect(
    [...document.querySelectorAll<HTMLElement>('figure')].every((panel) => !panel.hidden)
  ).toBe(true);
  expect(document.querySelector('a')?.hasAttribute('aria-selected')).toBe(false);
});

it('restores the selected source when a focused fallback can later acquire the Tree', () => {
  fixture();
  const root = document.querySelector<HTMLElement>('[data-code-file-browser]')!;
  const config = document.querySelector<HTMLElement>('#config-link')!;
  const css = document.querySelector<HTMLElement>('#css-link')!;
  config.dataset.codeFileSelected = 'false';
  css.dataset.codeFileSelected = 'true';
  css.focus();
  initStandaloneCodeFileBrowsers();
  expect(root.hasAttribute('data-file-browser-fallback')).toBe(true);
  expect([...root.querySelectorAll<HTMLElement>('figure')].every((panel) => !panel.hidden)).toBe(
    true
  );

  css.blur();
  initStandaloneCodeFileBrowsers();
  expect(root.hasAttribute('data-file-browser-fallback')).toBe(false);
  expect(root.dataset.fileBrowserInit).toBe('1');
  expect(document.querySelector<HTMLElement>('#config')!.hidden).toBe(true);
  expect(document.querySelector<HTMLElement>('#css')!.hidden).toBe(false);
  expect(
    root
      .querySelector('[role="treeitem"][aria-selected="true"]')
      ?.getAttribute('data-code-tree-path')
  ).toBe('src/style.css');
});

it('reveals native file focus inside the actual bounded viewport after its content is wrapped', () => {
  document.body.innerHTML = `<section data-code-file-browser><aside data-code-files>
    <div data-code-tree-scroll data-code-scroll-root><div data-code-content>
      <nav data-code-file-tabs><a href="#first" data-code-file-tab>first.ts</a>
      <a href="#last" data-code-file-tab>last.ts</a></nav>
    </div></div></aside></section>`;
  const viewport = document.querySelector<HTMLElement>('[data-code-tree-scroll]')!;
  const content = document.querySelector<HTMLElement>('[data-code-content]')!;
  const [first, last] = [...document.querySelectorAll<HTMLAnchorElement>('a')];
  Object.defineProperties(viewport, {
    clientHeight: { value: 100 },
    clientWidth: { value: 200 },
  });
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 200, 100));
  vi.spyOn(last, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 140, 200, 44));
  first.focus();
  initCodeFileBrowsers();
  initCodeFileBrowsers();
  document.documentElement.scrollTop = 37;

  // Native host navigation deliberately prevents the browser from moving the page.
  last.focus({ preventScroll: true });
  expect(viewport.scrollTop).toBe(64);
  expect(content.scrollTop).toBe(0);
  expect(document.documentElement.scrollTop).toBe(37);

  vi.spyOn(first, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, -20, 200, 44));
  first.focus({ preventScroll: true });
  expect(viewport.scrollTop).toBe(24);
  expect(document.documentElement.scrollTop).toBe(37);
});
