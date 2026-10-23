import { afterEach, expect, it, vi } from 'vitest';
import { initStandaloneCodeFileBrowsers } from './code-file-browser-client';
afterEach(() => { document.dispatchEvent(new Event('astro:before-swap')); document.body.replaceChildren(); vi.restoreAllMocks(); });
function fixture() {
  document.body.innerHTML = `<section data-standalone-file-browser data-code-file-browser><nav data-code-file-tabs aria-label="Files">
    <span data-code-directory-path="proto-ui"></span><span data-code-directory-path="proto-ui/empty"></span>
    <a href="#config" id="config-link" data-code-file-tab data-code-file-path="proto-ui/config.json" data-code-file-selected="true">config.json</a>
    <a href="#css" id="css-link" data-code-file-tab data-code-file-path="src/style.css">style.css</a>
    </nav><figure id="config" data-code-file-panel aria-labelledby="config-link"><pre>config exact</pre></figure>
    <figure id="css" data-code-file-panel aria-labelledby="css-link" hidden><pre>css exact</pre></figure></section>`;
}
it('selects real files without host preference coupling or source replacement, and cleans up', async () => {
  fixture(); const sources = [...document.querySelectorAll('pre')];
  initStandaloneCodeFileBrowsers(); initStandaloneCodeFileBrowsers();
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
  expect([...document.querySelectorAll<HTMLElement>('figure')].every((panel) => !panel.hidden)).toBe(true);
});
it('keeps every source reachable if real Tree admission fails', () => {
  fixture(); const get = Element.prototype.getAttribute;
  vi.spyOn(Element.prototype, 'getAttribute').mockImplementation(function(this: Element, name: string) {
    return name === 'role' && this.localName.endsWith('tree-item') ? null : get.call(this, name);
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  initStandaloneCodeFileBrowsers();
  expect(document.querySelector('[role="tree"]')).toBeNull();
  expect(document.querySelector<HTMLElement>('nav')!.hidden).toBe(false);
  expect([...document.querySelectorAll<HTMLElement>('figure')].every((panel) => !panel.hidden)).toBe(true);
  expect(document.querySelector('a')?.hasAttribute('aria-selected')).toBe(false);
});
