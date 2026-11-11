import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GET } from '../pages/styles/site-library-theme.css';

describe('Bootstrap navbar frame and family theme bank', () => {
  it('publishes distinct named light and dark navbar values without replacing Shadcn inputs', async () => {
    const css = await GET().text();
    expect(css).toContain('--site-bootstrap-navbar-top: #006dcc');
    expect(css).toContain('--site-bootstrap-navbar-top: #0055aa');
    expect(css).toContain('--site-bootstrap-foreground: #eeeeee');
    expect(css).toContain('--site-bootstrap-navbar-foreground: #ffffff');
    expect(css).toContain('--site-shadcn-font-sans:');
  });
  it('uses a bounded static-top navbar frame and gives both settings sufficient desktop space', () => {
    const css = readFileSync('apps/www/src/styles/site-header.css', 'utf8');
    expect(css).toContain('border-bottom: 1px solid var(--site-bootstrap-navbar-border)');
    expect(css).toContain('var(--site-bootstrap-navbar-top)');
    expect(css).toContain('grid-template-columns: minmax(12rem, 1fr) minmax(12rem, 1fr)');
    // Preserve the existing compact single-column flow instead of forcing
    // nowrap, shrinking text, or hiding the family name to satisfy the screenshot.
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).not.toContain(".pui-projection-control[data-control='family']");
  });
  it('targets the actual Docs wide Runtime owner without whitening compact popup labels or other families', () => {
    const css = readFileSync('apps/www/src/styles/site-header.css', 'utf8');
    const markup = readFileSync('apps/www/src/components/override/Header.astro', 'utf8');
    // Use the actual static owner tags and Runtime subtree, not an invented
    // direct child of .site-header. This checks selector applicability only,
    // not Astro rendering, lifecycle behavior, or browser-painted contrast.
    const header = markup.match(/<div class="site-header"[^>]*>/)?.[0];
    const wide = markup.match(
      /<div class="site-header-context"[^>]*data-site-header-wide-preferences[^>]*>/
    )?.[0];
    const compact = markup.match(/<div data-site-header-compact-context>/)?.[0];
    const runtime = markup.match(
      /<div class="site-header-runtime" data-site-header-preferences>[\s\S]*?<\/div>/
    )?.[0];
    expect([header, wide, compact, runtime].every(Boolean)).toBe(true);
    const inkRules = [...css.matchAll(
      /([^{}]+)\{\s*color:\s*var\(--site-bootstrap-navbar-foreground\);\s*\}/g
    )]
      .map((match) => match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim())
      .filter((selector) => selector.includes('.site-header-runtime-label'));
    expect(inkRules).toHaveLength(1);
    const host = document.createElement('div');
    host.dataset.siteLibraryFamily = 'bootstrap-2-3-2';
    host.innerHTML = `${header}${wide}${runtime}</div>${compact}</div></div>`;
    const owner = host.querySelector('[data-site-header-preferences]')!;
    const label = owner.querySelector('.site-header-runtime-label')!;
    const wideOwner = host.querySelector('[data-site-header-wide-preferences]')!;
    const compactOwner = host.querySelector('[data-site-header-compact-context]')!;
    expect(label.matches('.site-header > .site-header-runtime .site-header-runtime-label')).toBe(false);
    expect(label.matches(inkRules[0])).toBe(true);
    compactOwner.append(owner);
    expect(label.matches(inkRules[0])).toBe(false);
    wideOwner.append(owner);
    expect(label.matches(inkRules[0])).toBe(true);
    for (const family of ['shadcn', 'brutalist']) {
      host.dataset.siteLibraryFamily = family;
      expect(label.matches(inkRules[0])).toBe(false);
    }
  });
});
