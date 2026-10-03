import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applySiteLibraryFamily,
  requireSiteLibraryFamily,
  resolveSiteLibraryFamily,
  siteControlTags,
} from './site-library-family';

describe('website library family scope', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-site-library-family');
    document.body.innerHTML =
      '<main data-site-family-scope data-site-library-family="shadcn"></main>';
  });

  it.each([
    '/ui-libraries/brutalist/',
    '/en/ui-libraries/brutalist/tooltip/',
    '/zh-cn/ui-libraries/brutalist/button/',
    '/ui-libraries/brutalist',
  ])('resolves Brutalist library route %s without reading runtime preference', (path) => {
    expect(resolveSiteLibraryFamily(path)).toBe('brutalist');
  });

  it.each([
    '/',
    '/en/',
    '/zh-cn/start-here/',
    '/en/ui-libraries/base/toggle/',
    '/en/ui-libraries/shadcn/radio-group/',
    '/en/ui-libraries/brutalist-other/',
  ])('retains the default family for %s', (path) => {
    expect(resolveSiteLibraryFamily(path)).toBe('shadcn');
  });

  it('exposes actual family tag identities', () => {
    expect(
      Object.values(siteControlTags('brutalist')).every((tag) => tag.startsWith('wc-brutalist-'))
    ).toBe(true);
    expect(
      Object.values(siteControlTags('shadcn')).every((tag) => tag.startsWith('wc-shadcn-'))
    ).toBe(true);
  });

  it('updates only application scope markers on successful commit and can restore them', () => {
    document.documentElement.style.setProperty('--pui-background', 'canonical-shadcn');
    localStorage.setItem('preferred-prototypes-adapter', 'vue2');
    applySiteLibraryFamily(document, 'brutalist');
    expect(document.documentElement.dataset.siteLibraryFamily).toBe('brutalist');
    expect(document.querySelector<HTMLElement>('main')?.dataset.siteLibraryFamily).toBe(
      'brutalist'
    );
    expect(document.documentElement.style.getPropertyValue('--pui-background')).toBe(
      'canonical-shadcn'
    );
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('vue2');
    applySiteLibraryFamily(document, 'shadcn');
    expect(document.querySelector<HTMLElement>('main')?.dataset.siteLibraryFamily).toBe('shadcn');
    document.documentElement.style.removeProperty('--pui-background');
  });

  it('selects actual family prototypes in every website-owned document control', () => {
    for (const path of [
      'override/AdapterSelect.astro',
      'override/LanguageSelect.astro',
      'override/ThemeToggle.astro',
      'PrototypePreviewer/CodePanel.astro',
      'InstallCommandCard.astro',
    ]) {
      const source = readFileSync(`apps/www/src/components/${path}`, 'utf8');
      expect(source).toContain('resolveSiteLibraryFamily(Astro.url.pathname)');
      expect(source).toContain('siteControlTags(');
      expect(source).not.toContain('<wc-shadcn-');
    }
  });

  it('leaves Copy paint to the actual family Prototype recipe', () => {
    const css = readFileSync('apps/www/src/styles/code-surfaces.css', 'utf8');
    expect(css).not.toContain('.docs-code-copy');
    expect(css).not.toContain('.expressive-code .copy button');
    expect(css).toContain('[data-site-button]');
    expect(css).not.toContain('wc-shadcn-button[hidden]');
  });

  it('does not overwrite the canonical projection theme with application family tokens', () => {
    const css = readFileSync('apps/www/src/styles/site-library-family.css', 'utf8');
    expect(css).not.toMatch(/--pui-[\w-]+\s*:/);
    expect(css).toContain('--color-background: var(--site-brutalist-background)');
    expect(css).toContain('--site-surface-radius: 0');
  });
});

it('does not promote a partial demo family into whole-site support', () => {
  expect(requireSiteLibraryFamily('shadcn')).toBe('shadcn');
  expect(requireSiteLibraryFamily('brutalist')).toBe('brutalist');
  for (const family of ['bootstrap-2-3-2', 'liquid-glass', 'unknown', undefined, null])
    expect(() => requireSiteLibraryFamily(family)).toThrow(/unsupported whole-site family/);
});
