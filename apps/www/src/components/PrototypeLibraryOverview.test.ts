import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BRUTALIST_THEME,
  renderBrutalistThemeCss,
} from '../../../../packages/prototypes/brutalist/src/theme';

type BrutalistMode = keyof typeof BRUTALIST_THEME;

const source = readFileSync(
  resolve(process.cwd(), 'apps/www/src/components/PrototypeLibraryOverview.astro'),
  'utf8'
);
const overviewCss = source.match(/<style>([\s\S]*?)<\/style>/)?.[1];

if (!overviewCss) {
  throw new Error('PrototypeLibraryOverview.astro must include its component styles');
}

function mountOverview(mode: BrutalistMode): { scope: HTMLElement; demo: HTMLElement } {
  const style = document.createElement('style');
  style.setAttribute('data-overview-theme-test', '');
  style.textContent = [
    overviewCss,
    renderBrutalistThemeCss({
      variablePrefix: 'pui-',
      lightSelector: "[data-brutalist-theme='light']",
      darkSelector: "[data-brutalist-theme='dark']",
    }),
  ].join('\n');
  document.head.appendChild(style);

  const scope = document.createElement('section');
  scope.className = 'prototype-library prototype-library--brutalist';

  const demo = document.createElement('div');
  demo.className = 'prototype-card__demo';
  demo.dataset.brutalistTheme = mode;
  scope.appendChild(demo);
  document.body.appendChild(scope);
  return { scope, demo };
}

describe('PrototypeLibraryOverview Brutalist theme projection', () => {
  afterEach(() => {
    document.querySelectorAll('[data-overview-theme-test]').forEach((node) => node.remove());
    document.querySelectorAll('.prototype-library--brutalist').forEach((node) => node.remove());
  });

  it.each(['light', 'dark'] as const)(
    'keeps %s demo custom properties equal to the canonical theme manifest',
    (mode) => {
      const { demo } = mountOverview(mode);
      const expected = BRUTALIST_THEME[mode];

      for (const [name, value] of Object.entries(expected)) {
        expect(
          getComputedStyle(demo).getPropertyValue(`--pui-${name}`).trim(),
          `--pui-${name}`
        ).toBe(value);
      }

      for (const [background, foreground] of [
        ['main', 'main-foreground'],
        ['destructive', 'destructive-foreground'],
        ['accent', 'accent-foreground'],
      ] as const) {
        expect(getComputedStyle(demo).getPropertyValue(`--pui-${background}`).trim()).toBe(
          expected[background]
        );
        expect(getComputedStyle(demo).getPropertyValue(`--pui-${foreground}`).trim()).toBe(
          expected[foreground]
        );
      }
    }
  );
});
