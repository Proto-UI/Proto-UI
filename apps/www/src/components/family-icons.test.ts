// @vitest-environment node
import { readFileSync } from 'node:fs';
import { transform } from '@astrojs/compiler';
import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(`apps/www/src/components/${file}`, 'utf8');
describe('family-aware decorative icons', () => {
  it.each([
    'StaticFamilyIcon.astro',
    'StaticLucideIcon.astro',
    'UiLibraryGallery.astro',
    'PrototypeLibraryOverview.astro',
    'LucideIconGallery.astro',
    'Homepage/HomeActions.astro',
    'override/Hero.astro',
  ])('compiles %s for static server rendering', async (file) => {
    const result = await transform(source(file), { filename: file });
    expect(result.diagnostics.filter((d) => d.severity === 1)).toEqual([]);
    expect(result.code).toContain('createComponent');
  });
  it('keeps family artwork passive and statically rendered', () => {
    const family = source('StaticFamilyIcon.astro');
    expect(family).toContain("family === 'shadcn'");
    expect(family).toContain('<StaticLucideIcon name={name} size={size} inline />');
    expect(family).toContain("family === 'bootstrap-2-3-2'");
    expect(family).toContain("family === 'brutalist'");
    expect(family).toContain('aria-hidden="true"');
    expect(family).toContain('focusable="false"');
    expect(family).not.toContain('<script');
    expect(family).not.toMatch(/on:|client:/);
  });
  it('replaces only decorative navigation symbols and preserves named links', () => {
    for (const file of [
      'UiLibraryGallery.astro',
      'PrototypeLibraryOverview.astro',
      'override/Hero.astro',
    ]) {
      expect(source(file)).not.toMatch(/[↗→]/);
    }
    expect(source('UiLibraryGallery.astro').match(/family=\{library.id\}/g)).toHaveLength(3);
    expect(source('PrototypeLibraryOverview.astro')).toContain('family={library}');
    expect(source('LucideIconGallery.astro')).toContain('aria-label={copy.close}');
    expect(source('LucideIconGallery.astro')).toContain('<StaticLucideIcon name="x"');
  });
  it('hides the Base Select consumer glyph from the accessibility tree', () => {
    const demo = readFileSync('apps/www/src/content/docs/zh-cn/demo-base-select.demo.ts', 'utf8');
    expect(demo).toContain("attrs: { 'aria-hidden': 'true' }");
    const snippets = readFileSync(
      'apps/www/src/content/docs/demo_components/base-select/baseSelectCode.ts',
      'utf8'
    );
    expect(snippets.match(/aria-hidden="true"/g)).toHaveLength(4);
  });
  it('preserves readable lazy-load, error and no-script fallback instead of fake icons', () => {
    const gallery = source('LucideIconGallery.astro');
    expect(gallery).toContain('{icon.name}');
    expect(gallery).toContain('placeholder.textContent = name;');
    expect(gallery).toContain('preview.textContent = iconName;');
    expect(gallery).toContain('Icon unavailable');
    expect(gallery).toContain('<noscript>');
    expect(gallery).not.toMatch(/name\[0\]|textContent = '!'/);
  });
});
