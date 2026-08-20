import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'apps/www/src/components/override/AdapterSelect.astro'),
  'utf8'
);
const inlineScript = source.match(
  /<script is:inline define:vars=\{\{[^>]+\}\}>([\s\S]*?)<\/script>/
)?.[1];

if (!inlineScript) {
  throw new Error('AdapterSelect.astro must include an inline initialization script');
}

const adapterSelect = (id: string) => `
  <label for="${id}">Select adapter</label>
  <select id="${id}" data-adapter-select>
    <option value="wc">Web Components</option>
    <option value="react">React</option>
    <option value="vue">Vue</option>
  </select>
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
    const executableScript = `
      var PREFERRED_KEY = 'preferred-prototypes-adapter';
      var DEFAULT_ADAPTER = 'wc';
      var AdapterIds = ['wc', 'react', 'vue'];
      ${inlineScript}
    `;

    window.eval(executableScript);
    window.eval(executableScript);

    const selects = document.querySelectorAll<HTMLSelectElement>('[data-adapter-select]');
    expect(selects).toHaveLength(2);
    expect([...selects].every((select) => select.dataset.adapterSelectInitialized === 'true')).toBe(
      true
    );

    selects[1].value = 'react';
    selects[1].dispatchEvent(new Event('change', { bubbles: true }));

    expect(selects[0].value).toBe('react');
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('react');
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(changeListener).toHaveBeenCalledTimes(1);
  });
});
