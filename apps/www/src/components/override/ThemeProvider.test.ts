import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

type Theme = 'auto' | 'dark' | 'light';
type ThemeProviderApi = {
  updatePickers(theme?: Theme): void;
};
type ThemeWindow = Window &
  typeof globalThis & {
    StarlightThemeProvider?: ThemeProviderApi;
  };

const source = readFileSync(
  resolve(process.cwd(), 'apps/www/src/components/override/ThemeProvider.astro'),
  'utf8'
);
const inlineScript = source.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];

if (!inlineScript) {
  throw new Error('ThemeProvider.astro must include an inline initialization script');
}

describe('documentation theme provider compatibility', () => {
  it('defines the Starlight picker API used by the built-in mobile theme select', () => {
    const themeWindow = window as ThemeWindow;
    Reflect.deleteProperty(themeWindow, 'StarlightThemeProvider');
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
      })),
    });
    document.body.innerHTML = `
      <starlight-theme-select>
        <select>
          <option value="auto">Auto</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
        <svg class="label-icon"><path data-icon="old"></path></svg>
      </starlight-theme-select>
      <template id="starlight-theme-icons">
        <svg class="light"><path data-icon="light"></path></svg>
        <svg class="dark"><path data-icon="dark"></path></svg>
      </template>
    `;

    window.eval(inlineScript);

    expect(themeWindow.StarlightThemeProvider).toBeDefined();
    themeWindow.StarlightThemeProvider?.updatePickers('dark');
    expect(document.querySelector('select')?.value).toBe('dark');
    expect(document.querySelector('svg.label-icon path')?.getAttribute('data-icon')).toBe('dark');
  });
});
