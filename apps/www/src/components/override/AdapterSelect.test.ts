import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAdapterSelects, isRuntimeId } from '../adapter-preference';

afterEach(async () => {
  // Disconnect real WC trees while Happy DOM still owns their document. Their
  // nested async unmount chain must finish before the environment is destroyed.
  document.body.replaceChildren();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  delete document.documentElement.dataset.siteLibraryFamily;
  vi.restoreAllMocks();
});

const adapterSelect = (id: string) => `
  <div data-adapter-select>
    <label for="${id}">Select adapter</label>
    <select id="${id}">
      <option value="wc">Web Components</option>
      <option value="react">React</option>
      <option value="vue">Vue</option>
      <option value="vue2">Vue 2</option>
    </select>
  </div>
`;

describe('documentation adapter selector', () => {
  it('recognizes every public Vue runtime and rejects unknown ids', () => {
    expect(isRuntimeId('vue2')).toBe(true);
    expect(isRuntimeId('vue')).toBe(true);
    expect(isRuntimeId('svelte')).toBe(false);
  });

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `${adapterSelect('adapter-desktop')}${adapterSelect('adapter-mobile')}`;
  });

  it('binds and synchronizes every rendered selector instance exactly once', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const changeListener = vi.fn();
    document.addEventListener('proto-adapter:change', changeListener, { once: true });

    initAdapterSelects(document);
    initAdapterSelects(document);

    const selects = document.querySelectorAll<HTMLSelectElement>('[data-adapter-select] select');
    expect(selects).toHaveLength(2);
    expect([...selects].every((select) => select.dataset.adapterSelectInit === '1')).toBe(true);

    selects[1].value = 'react';
    selects[1].dispatchEvent(new Event('change', { bubbles: true }));

    expect(selects[0].value).toBe('react');
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('react');
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(changeListener).toHaveBeenCalledTimes(1);
  });
});

describe('family-independent adapter preference', () => {
  it('synchronizes the actual Brutalist controls without changing the document family', async () => {
    const { initSiteControls, registerSiteControls, selectValue } =
      await import('../site-shadcn-controls');
    registerSiteControls();
    localStorage.clear();
    document.documentElement.dataset.siteLibraryFamily = 'brutalist';
    const control = (family: string) => `<div data-adapter-select>
      <wc-${family}-select-root data-site-select-root data-adapter-select-root data-site-initial-value="wc">
        <wc-${family}-select-trigger><wc-${family}-select-value></wc-${family}-select-value></wc-${family}-select-trigger>
        <wc-${family}-select-content>
          <wc-${family}-select-item data-value="wc">Web Components</wc-${family}-select-item>
          <wc-${family}-select-item data-value="vue2">Vue 2</wc-${family}-select-item>
        </wc-${family}-select-content>
      </wc-${family}-select-root></div>`;
    document.body.innerHTML = control('brutalist') + control('shadcn');
    initSiteControls(document);
    initAdapterSelects(document);
    await Promise.resolve();
    await Promise.resolve();
    const controls = document.querySelectorAll<HTMLElement>('[data-adapter-select-root]');
    controls[0].dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'vue2' }, bubbles: true })
    );
    await Promise.resolve();
    await Promise.resolve();
    expect([...controls].map(selectValue)).toEqual(['vue2', 'vue2']);
    expect(document.documentElement.dataset.siteLibraryFamily).toBe('brutalist');
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('vue2');
  });
});
