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

const languageSelect = (family = 'shadcn') => `
  <div class="language-select-wrapper">
    <span>Select language</span>
    <wc-${family}-select-root
      data-site-select-root
      data-language-select-root
      data-language-select
      data-current-locale="en"
      data-value="en"
      data-locale-paths='{"en":"/en/docs/","zh-cn":"/zh-cn/docs/"}'
    >
      <wc-${family}-select-item data-value="en" data-text-value="English">English</wc-${family}-select-item>
      <wc-${family}-select-item data-value="zh-cn" data-text-value="简体中文">简体中文</wc-${family}-select-item>
    </wc-${family}-select-root>
  </div>
`;

describe('documentation language selector', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'preferred-locale=; Max-Age=0; path=/';
    window.history.replaceState(null, '', '/en/docs/');
    document.body.innerHTML = `${languageSelect()}${languageSelect('brutalist')}`;
    document.querySelectorAll<HTMLElement>('[data-language-select-root]').forEach((element) => {
      const root = element as HTMLElement & {
        getExposes?: () => Record<string, unknown>;
        setProps?: (next: { value?: string }) => void;
      };
      let value = 'en';
      root.setProps = (next: { value?: string }) => {
        if (next.value) value = next.value;
      };
      root.getExposes = () => ({ value: { get: () => value } });
    });
  });

  it('binds every rendered selector instance exactly once', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    window.eval(inlineScript);
    window.eval(inlineScript);

    const selects = document.querySelectorAll<HTMLElement>('[data-language-select-root]');
    expect(selects).toHaveLength(2);
    expect(
      [...selects].every((select) => select.dataset.languageSelectInitialized === 'true')
    ).toBe(true);

    selects[1].dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'zh-cn' }, bubbles: true })
    );

    expect(window.location.pathname).toBe('/zh-cn/docs/');
    expect(localStorage.getItem('preferred-locale')).toBe('zh-cn');
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});
