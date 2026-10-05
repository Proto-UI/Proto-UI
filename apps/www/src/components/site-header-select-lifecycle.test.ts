import { afterEach, describe, expect, it, vi } from 'vitest';
import { initSiteHeaderDisclosure, type SiteHeaderDisclosure } from './site-header-disclosure';
import {
  initSiteControls,
  registerSiteControls,
  type SiteSelectRoot,
} from './site-shadcn-controls';

let disclosure: SiteHeaderDisclosure | undefined;
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
afterEach(() => {
  disclosure?.destroy();
  disclosure = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function fixture(family: 'shadcn' | 'brutalist', compact = true) {
  registerSiteControls();
  const query = Object.assign(new EventTarget(), { matches: compact }) as MediaQueryList;
  vi.spyOn(window, 'matchMedia').mockReturnValue(query);
  document.body.innerHTML = `<header data-site-header data-docs-site-header>
    <nav data-site-header-desktop-navigation></nav>
    <div data-site-header-panel id="header-panel"><nav data-site-header-navigation></nav><div data-site-header-compact-context></div><div data-site-header-settings></div></div>
    <div data-site-header-context><div data-site-header-preferences><div data-adapter-select>
      <wc-${family}-select-root data-site-select-root data-site-initial-value="wc">
        <wc-${family}-select-trigger data-appearance="elevated"><wc-${family}-select-value></wc-${family}-select-value></wc-${family}-select-trigger>
        <wc-${family}-select-content data-site-select-content><wc-${family}-select-item data-value="wc" data-text-value="Web Components">Web Components</wc-${family}-select-item></wc-${family}-select-content>
      </wc-${family}-select-root>
    </div></div></div><button data-menu>Menu</button>
  </header>`;
  const header = document.querySelector<HTMLElement>('header')!;
  const select = header.querySelector<SiteSelectRoot>('[data-site-select-root]')!;
  const trigger = select.querySelector<HTMLElement>(`wc-${family}-select-trigger`)!;
  const menu = header.querySelector<HTMLButtonElement>('[data-menu]')!;
  initSiteControls(header);
  // Match the actual Header script's listener registration order.
  query.addEventListener('change', () => initSiteControls(header));
  disclosure = initSiteHeaderDisclosure(header);
  disclosure.bindButton(menu);
  disclosure.enhance();
  return { header, select, trigger, menu, query };
}

describe('Header keeps actual Select lifetime inside its visible owner', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const activation of ['toggle', 'click-only'] as const) {
      it(`${family}: ${activation} closes the real child before hiding the menu`, async () => {
        const { header, select, trigger, menu } = fixture(family);
        menu.addEventListener('click', () => disclosure!.toggle());
        disclosure!.toggle();
        await settle();
        trigger.click();
        await settle();
        expect(select.getExposes?.().open?.get?.()).toBe(true);
        if (activation === 'toggle') disclosure!.toggle();
        else menu.click(); // No preceding pointerdown/outside-press to mask this path.
        await settle();
        expect(select.getExposes?.().open?.get?.()).toBe(false);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(header.querySelector<HTMLElement>('[data-site-header-panel]')!.hidden).toBe(true);
        expect(document.activeElement).toBe(menu);
      });
    }
    for (const event of ['popstate', 'pageshow']) {
      it(`${family}: ${event} closes the real portaled Select before its parent`, async () => {
        const { header, select, trigger, menu } = fixture(family);
        disclosure!.toggle();
        await settle();
        trigger.click();
        await settle();
        expect(select.getExposes?.().open?.get?.()).toBe(true);
        const content = document.getElementById(trigger.getAttribute('aria-controls')!)!;
        expect(content).not.toBeNull();
        window.dispatchEvent(new Event(event));
        await settle();
        expect(select.getExposes?.().open?.get?.()).toBe(false);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(header.querySelector<HTMLElement>('[data-site-header-panel]')!.hidden).toBe(true);
        expect(document.activeElement).toBe(menu);
      });
    }
  }

  it('restores desktop ghost after a complete compact-to-desktop reparent', async () => {
    const { header, trigger, query } = fixture('shadcn', false);
    await settle();
    expect(trigger.getAttribute('data-pui-style')).toContain('border-transparent');
    Object.defineProperty(query, 'matches', { configurable: true, value: true });
    query.dispatchEvent(new Event('change'));
    await settle();
    expect(trigger.closest('[data-site-header-panel]')).not.toBeNull();
    expect(trigger.getAttribute('data-pui-style')).not.toContain('border-transparent');
    Object.defineProperty(query, 'matches', { configurable: true, value: false });
    query.dispatchEvent(new Event('change'));
    await settle();
    expect(trigger.closest('[data-site-header-panel]')).toBeNull();
    expect(header.querySelectorAll('[data-site-header-preferences]')).toHaveLength(1);
    expect(trigger.getAttribute('data-pui-style')).toContain('border-transparent');
  });
});
