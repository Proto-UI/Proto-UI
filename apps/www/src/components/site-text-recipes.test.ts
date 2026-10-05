import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { siteTextRecipe } from './site-text-recipes';
describe('documentation reading scale consumes public Text props', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`${family}: keeps body and family weight while reducing section hierarchy`, () => {
      expect(siteTextRecipe('h2', family)).toMatchObject({
        size: '2xl',
        leading: 'tight',
        weight: family === 'brutalist' ? 'bold' : 'semibold',
      });
      expect(siteTextRecipe('h3', family)).toMatchObject({ size: 'xl', leading: 'snug' });
      expect(siteTextRecipe('h4', family)).toMatchObject({ size: 'lg', leading: 'snug' });
      expect(siteTextRecipe('h1', family).size).toBe('4xl');
      expect(siteTextRecipe('body', family)).toMatchObject({ size: 'base', leading: 'relaxed' });
    });
  }
  it('matches section scale before JavaScript without overriding atom paint', () => {
    const css = readFileSync('apps/www/src/styles/markdown.css', 'utf8');
    expect(css).toMatch(/h2\s*\{[^}]*text-2xl leading-tight/);
    expect(css).toMatch(/h3\s*\{[^}]*text-xl leading-snug/);
    expect(css).toMatch(/h4\s*\{[^}]*text-lg leading-snug/);
    expect(css).toMatch(/sl-heading-wrapper\s*\{[^}]*mt-10/);
  });
});

it('compiles scoped native document fallback declarations without targeting Text paint', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  const { compile } = require('tailwindcss');
  const theme = readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
  const siteTheme = readFileSync('apps/www/src/styles/tailwindcss.css', 'utf8').replace(
    "@import 'tailwindcss';",
    ''
  );
  const compiler = await compile(
    theme + '\n' + siteTheme + '\n' + readFileSync('apps/www/src/styles/markdown.css', 'utf8')
  );
  const css: string = compiler.build([]);
  // Inspect actual Tailwind output; the browser suite verifies native fallback
  // geometry. HappyDOM does not implement cascade layers/complex selectors.
  const rules = Array.from(css.matchAll(/(\[data-site-family-scope\][^{]+)\{([^}]*)\}/g));
  const title = rules.find((rule) => rule[1]!.includes("h1[data-site-typography='h1']"));
  const description = rules.find((rule) => rule[1]!.includes("p[data-site-typography='tagline']"));
  expect(title).toBeDefined();
  expect(description).toBeDefined();
  expect(title![2]).toContain('font-size: var(--text-3xl)');
  expect(title![2]).toContain('line-height: var(--leading-tight)');
  expect(description![2]).toContain('font-size: var(--text-base)');
  expect(description![2]).toContain('line-height: var(--leading-relaxed)');
  expect(description![2]).toContain('color: var(--color-muted-foreground)');
  expect(css).toContain('--text-3xl: 1.875rem');
  expect(css).toContain('--leading-tight: 1.25');
  for (const rule of [title!, description!]) {
    expect(rule[1]).toContain("[data-site-library-family='shadcn']");
    expect(rule[1]).toContain('main[data-pagefind-body]');
    // HomepageRuntime is in the sibling Header, not an ancestor of main.
    expect(rule[1]).toContain(':not(:has([data-homepage-runtime]))');
    expect(rule[1]).toContain(':where(aside *, .starlight-aside *, [data-previewer-id] *)');
    expect(rule[1]).not.toContain('data-pui-style');
  }
});
