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

  it('keeps the article and preview ancestor free of competing frame paint', () => {
    const { scope } = mountOverview('light');
    const article = document.createElement('article');
    article.className = 'prototype-card';
    scope.append(article);
    const style = getComputedStyle(article);
    // Executed CSS fixture, not a claim about browser pixels. The old outer
    // Brutalist frame fails here even if an inner class says "surface".
    expect(style.borderTopStyle).not.toBe('solid');
    expect(style.boxShadow === '' || style.boxShadow === 'none').toBe(true);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(overviewCss!);
    const innerRule = Array.from(sheet.cssRules).find(
      (rule) =>
        (rule as CSSStyleRule).selectorText === '.prototype-card__demo :global(.proto-previewer)'
    ) as CSSStyleRule;
    expect(innerRule.style.borderRadius).toBe('');
    expect(innerRule.style.getPropertyValue('--runtime-box-content-padding')).toBe('1rem');
  });
});

it('distinguishes the workspace-only Spinner, npm packages and draft ecosystem train', () => {
  const spinner = source.match(/id: 'spinner',[\s\S]*?href: '[^']*'/)?.[0];
  expect(spinner).toBeDefined();
  expect(spinner).toContain(
    '仅工作区可用的 Spinner draft；npm 单包 0.2.0 和 0.3.0-alpha.1 均不含此组件，0.3 生态发行仍为 draft'
  );
  expect(spinner).toContain(
    'Workspace-only Spinner draft, absent from npm package versions 0.2.0 and 0.3.0-alpha.1; the 0.3 ecosystem train remains draft'
  );
  expect(source).toContain('<p>{entry.description}</p>');
  for (const locale of ['en', 'zh-cn']) {
    const page = readFileSync(
      resolve(
        process.cwd(),
        `apps/www/src/content/docs/${locale}/ui-libraries/brutalist/components/spinner.mdx`
      ),
      'utf8'
    );
    expect(page).toContain('`./spinner`');
    expect(page).toContain('V-PROTO-UI-0010');
    expect(page).toContain(locale === 'en' ? 'remains `draft`' : '仍为 `draft`');
    expect(page).toContain(locale === 'en' ? 'do not export' : '均不导出');
    expect(page).not.toContain(
      locale === 'en' ? '@0.3.0-alpha.1` is unpublished' : '@0.3.0-alpha.1` 尚未发布'
    );
  }
});
