import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initAdapterSelects, isRuntimeId } from '../adapter-preference';

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
