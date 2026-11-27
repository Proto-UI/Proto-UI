import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { linkSurfaceProps } from '../components/site-link-recipes';

const read = (path: string) => readFileSync(path, 'utf8');

describe('website and workspace aesthetic & optical alignment contracts', () => {
  it('uses borderless secondary pagination chips in Shadcn while preserving Brutalist and Bootstrap borders', () => {
    expect(linkSurfaceProps('shadcn', 'pagination', 'secondary')).toMatchObject({
      variant: 'secondary',
      border: 'none',
      elevation: 'none',
    });
    expect(linkSurfaceProps('brutalist', 'pagination', 'secondary')).toMatchObject({
      variant: 'secondary',
      border: 'all',
      elevation: 'raised',
    });
    expect(linkSurfaceProps('bootstrap-2-3-2', 'pagination', 'secondary')).toMatchObject({
      variant: 'outline',
      border: 'all',
      elevation: 'none',
    });
  });

  it('keeps Shadcn code frames borderless muted surfaces while preserving other family frames', () => {
    const codeSurface = read('apps/www/src/components/site-code-surface.ts');
    expect(codeSurface).toContain("purpose === 'code' && family === 'shadcn'");
    expect(codeSurface).toContain("? 'none'");
    expect(codeSurface).toContain(": 'all'");

    const codeExample = read('apps/www/src/components/CodeExample.astro');
    expect(codeExample).toContain('lineNumbers={false}');
    expect(codeExample).toContain('presentation="docs"');

    const fileBrowser = read('apps/www/src/components/CodeFileBrowser.astro');
    expect(fileBrowser).toContain('data-compact-file-browser');
    expect(fileBrowser).toContain('--code-file-browser-height: 13.5rem;');
  });

  it('keeps disclosure triangles inline, heading anchors hover-revealed, tables family-aware, and scrollbars thin', () => {
    const markdown = read('apps/www/src/styles/markdown.css');
    expect(markdown).toMatch(
      /details[\s\S]*summary[\s\S]*\[data-site-typography-carrier\][\s\S]*display:\s*inline;/
    );
    expect(markdown).toMatch(/\.sl-heading-wrapper\s*\{[^}]*items-center/);
    expect(markdown).toMatch(/\.sl-heading-wrapper a\s*\{[^}]*opacity:\s*0;/);
    expect(markdown).toContain('@media (hover: none)');
    expect(markdown).toContain(
      "[data-site-library-family='brutalist'] main[data-pagefind-body] table"
    );
    expect(markdown).toContain(
      "[data-site-library-family='bootstrap-2-3-2'] main[data-pagefind-body] table"
    );
    expect(markdown).toContain('scrollbar-width: thin;');

    const codeSurfaces = read('apps/www/src/styles/code-surfaces.css');
    expect(codeSurfaces).toContain('scrollbar-width: thin;');
    expect(codeSurfaces).toContain('::-webkit-scrollbar-thumb');

    const notice = read('apps/www/src/components/DocStageNotice.astro');
    expect(notice).toContain("[data-site-library-family='brutalist']");
    expect(notice).toContain("[data-site-library-family='bootstrap-2-3-2']");
    expect(notice).toContain("[data-site-library-family='liquid-glass']");
  });

  it('preserves homepage and header optical alignment across families and workspace scrollbars', () => {
    const home = read('apps/www/src/components/PrototypePreviewer/HomeDemoPreviewer.astro');
    expect(home).toContain('.home-gallery__row--spread');
    expect(home).toContain('justify-content: space-between;');
    expect(home).toMatch(/\.home-gallery__shortcut-title\)\s*\{\s*padding-inline:\s*0\.5rem;/);

    const galleryParts = read('apps/www/src/components/Homepage/homepage-gallery-parts.ts');
    expect(galleryParts).toContain('home-gallery__row home-gallery__row--spread');

    const header = read('apps/www/src/styles/site-header.css');
    expect(header).toContain('column-gap: 0.5rem;');
    expect(header).toContain('calc(var(--site-header-brand-navigation-gap) - 0.5rem)');

    const workspace = read('apps/workspace/src/styles.css');
    expect(workspace).toContain('scrollbar-width: thin;');
    expect(workspace).toMatch(/\.sidebar-header\s*\{[^}]*align-items:\s*center;/);
  });
});
