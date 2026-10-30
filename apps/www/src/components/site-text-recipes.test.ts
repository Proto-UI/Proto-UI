import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { siteTextRecipe, siteTextSurfaceStyle } from './site-text-recipes';
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

it('preserves notice title emphasis through the same public Text inputs as SSR', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    expect(siteTextRecipe('notice-title', family)).toMatchObject({
      size: 'base',
      weight: 'semibold',
      leading: 'relaxed',
      tone: 'default',
      font: 'body',
    });
  }
  const source = readFileSync('apps/www/src/components/DocStageNotice.astro', 'utf8');
  expect(source).toContain('data-site-typography="notice-title"');
  expect(source).toMatch(/font-size: 1rem/);
  expect(source).toMatch(/line-height: 1.625/);
  expect(source).not.toMatch(/font-size: 0\.(98|92)rem/);
});

it('matches pre-module paragraph rhythm and document heading ink to public Text inputs', () => {
  const css = readFileSync('apps/www/src/styles/markdown.css', 'utf8');
  expect(css).toContain('@apply text-3xl leading-tight text-foreground;');
  expect(css).toMatch(/docs-content-flow > blockquote p\s*\{\s*line-height: 1\.625;/);
});

// App-owned responsive composition. These are explicit input contracts, not a
// live resize listener test or a new Base Text viewport API.
describe('finite homepage Hero recipes', () => {
  const viewports = [
    { width: 320, bucket: 'small', heading: '3xl', tracking: 'tight', tagline: 'base' },
    { width: 639, bucket: 'small', heading: '3xl', tracking: 'tight', tagline: 'base' },
    { width: 640, bucket: 'medium', heading: '3xl', tracking: 'tight', tagline: 'lg' },
    { width: 767, bucket: 'medium', heading: '3xl', tracking: 'tight', tagline: 'lg' },
    { width: 768, bucket: 'medium', heading: '3xl', tracking: 'tight', tagline: 'lg' },
    { width: 1024, bucket: 'medium', heading: '3xl', tracking: 'tight', tagline: 'lg' },
    { width: 1279, bucket: 'medium', heading: '3xl', tracking: 'tight', tagline: 'lg' },
    { width: 1280, bucket: 'wide', heading: '5xl', tracking: 'tighter', tagline: 'lg' },
    { width: 1440, bucket: 'wide', heading: '5xl', tracking: 'tighter', tagline: 'lg' },
  ] as const;
  for (const { width, bucket, heading, tracking, tagline } of viewports) {
    it(`${width}px: composes exact Shadcn Hero inputs`, () => {
      expect(siteTextRecipe('slogan', 'shadcn', width < 768, 'site', bucket)).toEqual({
        size: heading,
        tone: 'default',
        weight: 'semibold',
        font: 'body',
        leading: 'tighter',
        tracking,
        emphasis: 'normal',
        decoration: 'none',
      });
      expect(siteTextRecipe('tagline', 'shadcn', width < 768, 'site', bucket)).toEqual({
        size: tagline,
        tone: 'default',
        weight: 'normal',
        font: 'body',
        leading: 'size',
        tracking: 'normal',
        emphasis: 'normal',
        decoration: 'none',
      });
    });
  }

  // Explicit old-contract table. Do not compare the new implementation with a
  // helper which merely repeats its branching or use toMatchObject here.
  const retainedRoles = {
    h1: { size: '4xl', leading: 'tight', tracking: 'tight', heading: true },
    h2: { size: '2xl', leading: 'tight', tracking: 'tight', heading: true },
    h3: { size: 'xl', leading: 'snug', tracking: 'normal', heading: true },
    h4: { size: 'lg', leading: 'snug', tracking: 'normal', heading: true },
    h5: { size: 'lg', leading: 'snug', tracking: 'normal', heading: true },
    h6: { size: 'base', leading: 'normal', tracking: 'normal', heading: true },
    body: { size: 'base', leading: 'relaxed', tracking: 'normal', heading: false },
    label: { size: 'sm', leading: 'normal', tracking: 'normal', heading: false },
    'notice-title': { size: 'base', leading: 'relaxed', tracking: 'normal', heading: false },
    caption: { size: 'sm', leading: 'normal', tracking: 'normal', heading: false },
  } as const;
  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const context of ['site', 'document'] as const) {
      for (const compact of [false, true]) {
        it(`${family}/${context}/compact=${compact}: all non-Hero inputs remain exact in every bucket`, () => {
          for (const bucket of ['small', 'medium', 'wide'] as const) {
            for (const role of Object.keys(retainedRoles) as Array<keyof typeof retainedRoles>) {
              const old = retainedRoles[role];
              const reading = family === 'shadcn' && context === 'document';
              expect(siteTextRecipe(role, family, compact, context, bucket)).toEqual({
                size: reading && role === 'h1' ? '3xl' : old.size,
                tone:
                  role === 'caption' ? 'muted' : reading && role === 'body' ? 'inherit' : 'default',
                weight:
                  role === 'notice-title'
                    ? 'semibold'
                    : old.heading
                      ? family === 'brutalist'
                        ? 'bold'
                        : 'semibold'
                      : family === 'brutalist' || role === 'label'
                        ? 'medium'
                        : 'normal',
                font: old.heading && family === 'brutalist' ? 'heading' : 'body',
                leading: old.leading,
                tracking: old.tracking,
                emphasis: 'normal',
                decoration: 'none',
              });
            }
          }
        });
        if (family === 'shadcn' && context === 'site') continue;
        it(`${family}/${context}/compact=${compact}: existing slogan/tagline recipes ignore Hero bucket`, () => {
          for (const bucket of ['small', 'medium', 'wide'] as const) {
            expect(siteTextRecipe('slogan', family, compact, context, bucket)).toEqual({
              size: compact ? '2xl' : '4xl',
              tone: 'default',
              weight: family === 'brutalist' ? 'bold' : 'semibold',
              font: family === 'brutalist' ? 'heading' : 'body',
              leading: 'tight',
              tracking: 'tight',
              emphasis: 'normal',
              decoration: 'none',
            });
            expect(siteTextRecipe('tagline', family, compact, context, bucket)).toEqual({
              size: compact || (context === 'document' && family === 'shadcn') ? 'base' : 'lg',
              tone: 'muted',
              weight: family === 'brutalist' ? 'medium' : 'normal',
              font: 'body',
              leading: 'relaxed',
              tracking: 'normal',
              emphasis: 'normal',
              decoration: 'none',
            });
          }
        });
      }
    }
  }
  it('keeps an omitted viewport finite and independent of the browser global', () => {
    expect(siteTextRecipe('slogan', 'shadcn')).toEqual(
      siteTextRecipe('slogan', 'shadcn', false, 'site', 'medium')
    );
    expect(siteTextRecipe('tagline', 'shadcn', true)).toEqual(
      siteTextRecipe('tagline', 'shadcn', true, 'site', 'small')
    );
  });
});

it('Hero native fallback and public recipes share the finite source breakpoints without painting enhanced Text', () => {
  const hero = readFileSync('apps/www/src/components/override/Hero.astro', 'utf8');
  expect(hero).toContain(
    '3d98900e9b73c45f035f8109e9d41ba6a51685e7/apps/v4/components/page-header.tsx'
  );
  expect(hero).toContain('max-width: 56rem');
  expect(hero).toContain('@media (min-width: 640px)');
  expect(hero).toContain('@media (min-width: 1280px)');
  const fallbackRules = [
    ...hero.matchAll(/([^{}]+)\{([^{}]*(?:font-size|font-weight|letter-spacing)[^{}]*)\}/g),
  ];
  expect(fallbackRules).toHaveLength(4);
  for (const match of fallbackRules) {
    expect(match[1]).toContain(":global([data-site-library-family='shadcn'])");
    expect(match[1]).toContain(':not([data-typography-owner])');
  }
  expect(hero).not.toContain('[data-typography-prototype]');
  expect(hero).toContain('whitepaperHref');
  expect(hero).toContain('actions={actions}');
});

it('keeps authored Overview card roles compact without changing document or Hero recipes', () => {
  const source = readFileSync('apps/www/src/components/PrototypeLibraryOverview.astro', 'utf8');
  expect(source).toContain('<h2 data-site-typography="overview-card-title">');
  expect(source).toContain('<p data-site-typography="overview-card-description">');
  expect(source).toContain('<span>{copy.demo}</span>');
  expect(siteTextSurfaceStyle('overview-card-title')).toEqual({
    fontSize: '1rem',
    lineHeight: '1.25rem',
    fontFamily: 'inherit',
    letterSpacing: 'inherit',
  });
  expect(siteTextSurfaceStyle('overview-card-description')).toEqual({
    fontSize: '0.76rem',
    lineHeight: '1.14rem',
    fontFamily: 'inherit',
    letterSpacing: 'inherit',
  });
  for (const family of ['shadcn', 'brutalist'] as const) {
    expect(siteTextRecipe('overview-card-title', family)).toMatchObject({
      size: 'base',
      weight: 'semibold',
      leading: 'size',
      tracking: 'tight',
    });
    expect(siteTextRecipe('overview-card-description', family)).toMatchObject({
      size: 'xs',
      weight: 'normal',
      tone: 'muted',
      leading: 'size',
    });
    expect(siteTextRecipe('h2', family).size).toBe('2xl');
    expect(siteTextRecipe('body', family).size).toBe('base');
    expect(siteTextSurfaceStyle('h2')).toEqual({});
    expect(siteTextSurfaceStyle('slogan')).toEqual({});
  }
});

it('preserves the native reading TOC title without changing generic labels', () => {
  const source = readFileSync(
    'apps/www/src/components/override/TableOfContents/TableOfContents.astro',
    'utf8'
  );
  expect(source).toContain(
    '<h2 data-site-typography="reading-toc-title" id="starlight__on-this-page">'
  );
  expect(source).toContain('aria-labelledby="starlight__on-this-page"');
  expect(siteTextSurfaceStyle('reading-toc-title')).toEqual({
    fontSize: '0.75rem',
    lineHeight: '1rem',
    fontFamily: 'inherit',
    fontWeight: 'inherit',
    letterSpacing: 'inherit',
  });
  for (const family of ['shadcn', 'brutalist'] as const) {
    expect(siteTextRecipe('reading-toc-title', family)).toMatchObject({
      size: 'xs',
      tone: 'inherit',
      leading: 'size',
    });
    expect(siteTextRecipe('label', family).size).toBe('sm');
    expect(siteTextRecipe('h2', family).size).toBe('2xl');
    expect(siteTextSurfaceStyle('label')).toEqual({});
  }
});

it('document-heading inherits the single native responsive reading scale, not a late family font', () => {
  expect(siteTextSurfaceStyle('h1', 'document')).toEqual({
    fontSize: 'inherit',
    lineHeight: 'inherit',
    fontFamily: 'inherit',
    fontWeight: 'inherit',
    letterSpacing: 'inherit',
  });
  // Scope negatives: normal headings, Hero and component-owned text retain
  // their existing family contracts; this is not a Base Text default change.
  expect(siteTextSurfaceStyle('h1')).toEqual({});
  expect(siteTextSurfaceStyle('h1', 'site')).toEqual({});
  expect(siteTextSurfaceStyle('h2', 'document')).toEqual({});
  expect(siteTextSurfaceStyle('slogan', 'document')).toEqual({});
  expect(siteTextRecipe('h1', 'brutalist')).toMatchObject({
    size: '4xl',
    weight: 'bold',
    font: 'heading',
    leading: 'tight',
  });
  const typography = readFileSync('apps/www/src/components/site-typography.ts', 'utf8');
  expect(typography).toContain('...siteTextSurfaceStyle(role, context)');
  const css = readFileSync('apps/www/src/styles/markdown.css', 'utf8');
  expect(css).toMatch(
    /main\[data-pagefind-body\] h1\s*\{\s*@apply scroll-m-20 text-\[2rem\] leading-\[2\.5rem\] font-semibold tracking-tight md:text-\[2\.25rem\] md:leading-\[2\.75rem\];/
  );
});
