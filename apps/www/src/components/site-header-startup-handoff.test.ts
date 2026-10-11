import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
const css = readFileSync('apps/www/src/styles/site-header.css', 'utf8');
const boundary =
  /\.site-header\[data-docs-site-header\]:not\(\[data-site-menu-ready\]\) \[data-site-menu-button\] \{[^}]+\}/;
afterEach(() => document.body.replaceChildren());
function fixture(styles = css, docs = true, ready = false) {
  document.body.innerHTML = `<style>${styles}</style><div class="site-header" ${docs ? 'data-docs-site-header' : ''} ${ready ? 'data-site-menu-ready' : ''}><details class="site-header-panel"><summary data-site-header-fallback-summary>Native menu</summary></details><div class="site-header-menu"><wc-shadcn-button data-site-menu-button style="display:inline-flex;transition:all 150ms">Future menu</wc-shadcn-button></div></div>`;
  const root = document.querySelector<HTMLElement>('.site-header')!;
  return {
    root,
    summary: root.querySelector('summary')!,
    cell: root.querySelector<HTMLElement>('.site-header-menu')!,
    button: root.querySelector<HTMLElement>('[data-site-menu-button]')!,
  };
}
describe('Docs menu startup publication boundary (DOM/CSS, not native paint)', () => {
  it('keeps the future Button unrendered while reserving its outer cell and retaining native summary', () => {
    const { root, summary, cell, button } = fixture();
    expect(getComputedStyle(button).display).toBe('none');
    expect(getComputedStyle(summary).display).toBe('flex');
    expect(getComputedStyle(cell).display).toBe('flex');
    expect(getComputedStyle(cell).width).toBe('44px');
    expect(getComputedStyle(cell).height).toBe('44px');
    // Resolve each authored state afresh: this DOM engine does not invalidate
    // ancestor-attribute selector caches. Dynamic transition/focus continuity
    // remains the native browser gate.
    const published = fixture(css, true, true);
    expect(getComputedStyle(published.button).display).toBe('inline-flex');
    expect(getComputedStyle(published.summary).display).toBe('none');
    expect(getComputedStyle(published.cell).width).toBe('44px');
    expect(getComputedStyle(published.cell).height).toBe('44px');
  });
  it('detects the removed boundary without changing the candidate or native oracle', () => {
    expect(css.match(boundary)).not.toBeNull();
    const { button } = fixture(css.replace(boundary, ''));
    expect(getComputedStyle(button).display).toBe('inline-flex');
    expect(getComputedStyle(button).visibility).toBe('hidden');
  });
  it('does not change the homepage candidate or the Prototype transition recipe', () => {
    const { button } = fixture(css, false);
    expect(getComputedStyle(button).display).toBe('inline-flex');
    expect(css.match(boundary)?.[0]).not.toMatch(/transition|animation|opacity/);
    const prototype = readFileSync('packages/prototypes/shadcn/src/button/button.proto.ts', 'utf8');
    expect(prototype).toContain("'transition-all'");
  });
});
