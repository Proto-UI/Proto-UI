import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initAdapterSelects } from '../adapter-preference';

const adapterSelect = (id: string) => `
  <div data-adapter-select>
    <label for="${id}">Select adapter</label>
    <select id="${id}">
      <option value="wc">Web Components</option>
      <option value="react">React</option>
      <option value="vue">Vue</option>
    </select>
  </div>
`;

describe('documentation adapter selector', () => {
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
