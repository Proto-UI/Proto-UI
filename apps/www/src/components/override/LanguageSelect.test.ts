import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'apps/www/src/components/override/LanguageSelect.astro'),
  'utf8'
);
const inlineScript = source.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];

if (!inlineScript) {
  throw new Error('LanguageSelect.astro must include an inline initialization script');
}

const languageSelect = () => `
  <label class="language-select-wrapper">
    <span>Select language</span>
    <select
      class="language-select"
      data-language-select
      data-current-locale="en"
      data-locale-paths='{"en":"/en/docs/","zh-cn":"/zh-cn/docs/"}'
    >
      <option value="en" selected>English</option>
      <option value="zh-cn">简体中文</option>
    </select>
  </label>
`;

describe('documentation language selector', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'preferred-locale=; Max-Age=0; path=/';
    window.history.replaceState(null, '', '/en/docs/');
    document.body.innerHTML = `${languageSelect()}${languageSelect()}`;
  });

  it('binds every rendered selector instance exactly once', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    window.eval(inlineScript);
    window.eval(inlineScript);

    const selects = document.querySelectorAll<HTMLSelectElement>('.language-select');
    expect(selects).toHaveLength(2);
    expect(
      [...selects].every((select) => select.dataset.languageSelectInitialized === 'true')
    ).toBe(true);

    selects[1].value = 'zh-cn';
    selects[1].dispatchEvent(new Event('change', { bubbles: true }));

    expect(window.location.pathname).toBe('/zh-cn/docs/');
    expect(localStorage.getItem('preferred-locale')).toBe('zh-cn');
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});
