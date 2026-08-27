import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFERRED_ADAPTER_KEY, initAdapterSelects } from './adapter-preference';

function adapterSelectMarkup(id: string, runtimes: readonly string[]): string {
  return `<div data-adapter-select>
    <select id="${id}">
      ${runtimes.map((runtime) => `<option value="${runtime}">${runtime}</option>`).join('')}
    </select>
  </div>`;
}

function previewerMarkup(id: string, runtimes: readonly string[]): string {
  return `<div data-previewer-id="${id}">
    ${adapterSelectMarkup(`${id}-runtime`, runtimes)}
  </div>`;
}

function select(id: string): HTMLSelectElement {
  return document.querySelector<HTMLSelectElement>(`#${id}`)!;
}

describe('AdapterSelect preference synchronization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('routes a supported global preference through a multi-runtime previewer change', () => {
    document.body.innerHTML =
      adapterSelectMarkup('global-adapter', ['wc', 'react', 'vue']) +
      previewerMarkup('multi', ['wc', 'react', 'vue']);
    initAdapterSelects(document);

    const globalSelect = select('global-adapter');
    const previewSelect = select('multi-runtime');
    const runtimeChanges = vi.fn();
    previewSelect.addEventListener('change', () => runtimeChanges(previewSelect.value));

    globalSelect.value = 'react';
    globalSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(localStorage.getItem(PREFERRED_ADAPTER_KEY)).toBe('react');
    expect(previewSelect.value).toBe('react');
    expect(runtimeChanges).toHaveBeenCalledOnce();
    expect(runtimeChanges).toHaveBeenCalledWith('react');
  });

  it('keeps a single-runtime previewer selected when the global preference is unsupported', () => {
    document.body.innerHTML =
      adapterSelectMarkup('global-adapter', ['wc', 'react', 'vue']) +
      previewerMarkup('single', ['wc']);
    initAdapterSelects(document);

    const globalSelect = select('global-adapter');
    const previewSelect = select('single-runtime');
    const runtimeChanges = vi.fn();
    previewSelect.addEventListener('change', () => runtimeChanges(previewSelect.value));

    globalSelect.value = 'vue';
    globalSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(localStorage.getItem(PREFERRED_ADAPTER_KEY)).toBe('vue');
    expect(previewSelect.value).toBe('wc');
    expect(previewSelect.selectedIndex).toBe(0);
    expect(runtimeChanges).not.toHaveBeenCalled();
  });
});
