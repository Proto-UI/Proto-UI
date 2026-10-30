import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initSiteNativeControls,
  siteSidebarTextRole,
  siteIsReadingToc,
} from './site-native-controls';
vi.mock('./PrototypePreviewer/projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: (family: string) => ({
    '--pui-foreground': family === 'brutalist' ? '#111' : '#222',
  }),
}));
const releases: Array<() => void> = [];
const settle = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};
afterEach(() => {
  for (const release of releases.splice(0)) release();
  document.body.replaceChildren();
  delete document.documentElement.dataset.siteLibraryFamily;
  vi.restoreAllMocks();
});

describe('website native anchor composition', () => {
  it.each(['data-site-header-navigation', 'data-site-header-desktop-navigation'])(
    '%s retains navigation current feedback on the actual passive surface',
    async (attribute) => {
      document.body.innerHTML = `<nav ${attribute}><a data-site-native-button href="/docs/">Docs</a></nav>`;
      const link = document.querySelector('a')!;
      releases.push(initSiteNativeControls());
      await settle();
      const surface = link.querySelector('wc-site-shadcn-text, wc-site-brutalist-text')!;
      expect(link.dataset.siteLinkAppearance).toBe('nav');
      link.setAttribute('aria-current', 'page');
      await vi.waitFor(() =>
        expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).toContain('font-semibold')
      );
      expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('underline');
      expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).toContain('font-semibold');
      link.removeAttribute('aria-current');
      await vi.waitFor(() =>
        expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('font-semibold')
      );
      expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('underline');
      expect(link.getAttribute('href')).toBe('/docs/');
      expect(surface.hasAttribute('tabindex')).toBe(false);
    }
  );
  it('maps evidence to the nearest action group mount even inside another active surface', () => {
    const browser = readFileSync(
      'apps/www/src/content/docs/zh-cn/site-native-links.browser.test.ts',
      'utf8'
    );
    const measured = browser.match(
      /owner-bounded-start[^\n]*\n([\s\S]*?)\s*\/\/ owner-bounded-end/
    )?.[1];
    expect(measured).toBeTruthy();
    const inspect = new Function('group', 'anchor', measured + '\nreturn { index, source };') as (
      group: Element,
      anchor: Element
    ) => { index: number; source: Element };
    document.body.innerHTML = `<section data-projection-generation-state="active"><div data-homepage-actions><div data-homepage-fallback><a href="/docs/">Docs</a></div><div data-homepage-mount><div data-projection-generation-state="active"><a href="/docs/" data-live>Docs</a></div></div></div></section>`;
    const group = document.querySelector('[data-homepage-actions]')!;
    const live = group.querySelector('[data-live]')!;
    expect(inspect(group, live)).toEqual({
      index: 0,
      source: group.querySelector('[data-homepage-fallback] a'),
    });
    const extra = document.createElement('a');
    live.parentElement!.append(extra);
    expect(() => inspect(group, extra)).toThrow('no source');
    const mount = group.querySelector('[data-homepage-mount]')!;
    mount.append(mount.firstElementChild!.cloneNode(true));
    expect(() => inspect(group, live)).toThrow('exactly one active generation');
  });

  it('retains the native link and moves only its content into a passive visual Prototype', async () => {
    document.body.innerHTML =
      '<a data-site-native-button href="/docs/" target="_blank" rel="noreferrer" aria-label="Docs"><span>Docs</span></a>';
    const link = document.querySelector('a')!;
    document.documentElement.dataset.siteLibraryFamily = 'brutalist';
    releases.push(initSiteNativeControls());
    await settle();
    let surface = link.querySelector(
      'wc-site-shadcn-surface, wc-site-brutalist-surface'
    ) as HTMLElement & {
      getExposes(): Record<string, unknown>;
    };
    expect(surface).not.toBeNull();
    expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).toContain('border-black');
    expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).toContain('rounded-base');
    expect(surface.textContent).toBe('Docs');
    expect(surface.getExposes()).toEqual({});
    expect(surface.hasAttribute('role')).toBe(false);
    expect(surface.hasAttribute('tabindex')).toBe(false);
    expect(link.getAttribute('href')).toBe('/docs/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer');
    expect(link.getAttribute('aria-label')).toBe('Docs');
    expect(link.hasAttribute('role')).toBe(false);
    expect(link.hasAttribute('data-slot')).toBe(false);
    link.dispatchEvent(new Event('pointerenter'));
    await settle();
    expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).toContain('translate-x-1');
    link.dispatchEvent(new Event('pointerleave'));
    await settle();
    expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('translate-x-1');
    document.documentElement.dataset.siteLibraryFamily = 'shadcn';
    await new Promise((resolve) => setTimeout(resolve, 0));
    await settle();
    surface = link.querySelector('wc-site-shadcn-surface') as typeof surface;
    expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).toContain('rounded-lg');
    expect(surface.getAttribute('data-pui-style')?.split(/\s+/)).not.toContain('rounded-base');
  });
  it('does not wrap a homepage transaction and supports cleanup followed by reinitialization', async () => {
    document.body.innerHTML =
      '<a data-site-native-button href="/docs/">Docs</a><div data-homepage-actions><a data-site-native-link href="/home/">Home</a></div>';
    const release = initSiteNativeControls();
    const releaseDuplicate = initSiteNativeControls();
    await settle();
    expect(
      document.querySelectorAll('wc-site-shadcn-surface, wc-site-brutalist-surface')
    ).toHaveLength(1);
    releaseDuplicate();
    expect(
      document.querySelector(
        '[data-homepage-actions] :is(wc-site-shadcn-surface,wc-site-brutalist-surface)'
      )
    ).toBeNull();
    const first = document.querySelector('wc-site-shadcn-surface, wc-site-brutalist-surface')!;
    release();
    expect(document.querySelector('wc-site-shadcn-surface, wc-site-brutalist-surface')).toBeNull();
    releases.push(initSiteNativeControls());
    await settle();
    expect(document.querySelector('wc-site-shadcn-surface, wc-site-brutalist-surface')).not.toBe(
      first
    );
    expect(
      document.querySelectorAll('wc-site-shadcn-surface, wc-site-brutalist-surface')
    ).toHaveLength(1);
  });
});

it.each(['shadcn', 'brutalist'])(
  'projects %s Sidebar authored hierarchy through the shared compact Text recipe',
  async (family) => {
    document.documentElement.dataset.siteLibraryFamily = family;
    document.body.innerHTML = `<aside class="sidebar-pane"><ul class="top-level"><li><details open><summary id="top">Top</summary><ul><li><a href="#article">Article</a></li><li><details open><summary id="nested">Nested</summary><ul><li><a href="#child">Child</a></li></ul></details></li></ul></details></li></ul></aside><a id="outside" href="#outside">Outside</a>`;
    expect(siteSidebarTextRole(document.querySelector<HTMLElement>('#outside')!)).toBeUndefined();
    releases.push(initSiteNativeControls());
    await settle();
    for (const [selector, role, fontSize] of [
      ['#top', 'top-group', '0.75rem'],
      ['#nested', 'nested-group', '0.8125rem'],
      ['a[href="#article"]', 'row', '0.8125rem'],
      ['a[href="#child"]', 'row', '0.8125rem'],
    ] as const) {
      const link = document.querySelector<HTMLElement>(selector)!;
      expect(siteSidebarTextRole(link)).toBe(role);
      const text = link.querySelector<HTMLElement>('[data-site-link-text]')!;
      await vi.waitFor(() => expect(text.style.fontSize).toBe(fontSize));
      expect(text.style.lineHeight).toBe('1.25rem');
      expect(link.querySelector<HTMLElement>('[data-site-link-content]')!.style.marginBottom).toBe(
        '0px'
      );
      expect(link.hasAttribute('role')).toBe(false);
    }
  }
);

it('projects only ordinary right reading TOC through its finite compact recipe', async () => {
  document.body.innerHTML = `<aside class="right-sidebar"><sl-toc><a id="reading" href="#one" data-site-native-link data-site-link-appearance="toc"><span>One</span></a><ul class="isMobile"><li><a id="mobile" href="#two" data-site-native-link data-site-link-appearance="toc">Two</a></li></ul></sl-toc></aside><sl-toc><a id="other" href="#three">Three</a></sl-toc>`;
  expect(siteIsReadingToc(document.querySelector<HTMLElement>('#reading')!)).toBe(true);
  expect(siteIsReadingToc(document.querySelector<HTMLElement>('#mobile')!)).toBe(false);
  expect(siteIsReadingToc(document.querySelector<HTMLElement>('#other')!)).toBe(false);
  releases.push(initSiteNativeControls());
  await settle();
  const reading = document.querySelector<HTMLElement>('#reading')!;
  const text = reading.querySelector<HTMLElement>('[data-site-link-text]')!;
  await vi.waitFor(() => expect(text.style.fontSize).toBe('0.8rem'));
  expect(text.style.lineHeight).toBe('1rem');
  expect(reading.querySelector<HTMLElement>('[data-site-link-content]')!.style.minHeight).toBe(
    '1.5rem'
  );
  expect(
    document.querySelector<HTMLElement>('#mobile [data-site-link-content]')!.style.minHeight
  ).toBe('var(--site-navigation-row-height, 2rem)');
});
