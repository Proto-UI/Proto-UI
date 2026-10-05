import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { initSiteNativeControls } from './site-native-controls';

vi.mock('./PrototypePreviewer/projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: (family: string) => ({
    '--pui-foreground': family === 'brutalist' ? '#111' : '#222',
  }),
}));
const releases: Array<() => void> = [];
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let index = 0; index < 12; index++) await Promise.resolve();
};
afterEach(() => {
  for (const release of releases.splice(0)) release();
  document.body.replaceChildren();
  delete document.documentElement.dataset.siteLibraryFamily;
});

describe('documentation native-navigation visual bridge', () => {
  it.each(['shadcn', 'brutalist'] as const)(
    'preserves native identity and pagination name nodes in %s',
    async (family) => {
      document.body.innerHTML = `<div class="sidebar-pane"><ul class="top-level"><li>
      <details open><summary>Section</summary><ul><li><a href="/next/" aria-current="page" target="_blank" rel="noreferrer"><span>Page</span><span class="docs-wip-badge">WIP</span></a></li></ul></details>
    </li></ul></div><div class="pagination-links"><a href="/previous/" rel="prev"><svg></svg><span>Previous<br><span class="link-title">Title</span></span></a></div><a href="/prose/">Prose</a>`;
      const sidebar = document.querySelector<HTMLAnchorElement>('.sidebar-pane a')!;
      const pagination = document.querySelector<HTMLAnchorElement>('.pagination-links a')!;
      const summary = document.querySelector('summary')!;
      const badge = sidebar.querySelector('.docs-wip-badge')!;
      const label = pagination.querySelector('span')!;
      const title = pagination.querySelector('.link-title')!;
      const lineBreak = pagination.querySelector('br')!;
      const beforeNodes = Array.from(label.childNodes);
      const name = pagination.textContent;
      document.documentElement.dataset.siteLibraryFamily = family;
      const release = initSiteNativeControls();
      releases.push(release);
      await settle();
      expect(document.querySelector('.sidebar-pane a')).toBe(sidebar);
      expect(document.querySelector('summary')).toBe(summary);
      expect(
        summary.querySelector(':is(wc-site-shadcn-surface,wc-site-brutalist-surface)')?.localName
      ).toBe(`wc-site-${family}-surface`);
      expect(sidebar.querySelector('.docs-wip-badge')).toBe(badge);
      expect(sidebar.getAttribute('aria-current')).toBe('page');
      expect(sidebar.getAttribute('target')).toBe('_blank');
      expect(sidebar.getAttribute('rel')).toBe('noreferrer');
      expect(sidebar.querySelector('[data-pui-root]')?.getAttribute('data-pui-style')).toContain(
        family === 'brutalist' ? 'bg-main' : 'bg-accent'
      );
      expect(pagination.querySelector('.link-title')).toBe(title);
      expect(pagination.querySelector('br')).toBe(lineBreak);
      expect(pagination.querySelector('a,button,[tabindex]')).toBeNull();
      expect(pagination.textContent).toBe(name);
      expect(label.parentElement?.parentElement).toBe(pagination.firstElementChild);
      expect(label.parentElement?.hasAttribute('data-site-link-text')).toBe(true);
      expect(lineBreak.parentElement?.hasAttribute('data-site-pagination-caption')).toBe(true);
      expect(
        document.querySelector(
          'a[href="/prose/"] :is(wc-site-shadcn-surface,wc-site-brutalist-surface)'
        )
      ).toBeNull();
      const duplicate = initSiteNativeControls();
      expect(pagination.querySelectorAll('[data-site-pagination-caption]')).toHaveLength(1);
      duplicate();
      release();
      expect(label.parentElement).toBe(pagination);
      expect(Array.from(label.childNodes)).toEqual(beforeNodes);
      expect(pagination.querySelector('[data-site-pagination-caption]')).toBeNull();
      expect(pagination.textContent).toBe(name);
    }
  );

  it.each(['prev', 'next'])(
    '%s arrow and text remain sibling items through family replacement',
    async (rel) => {
      document.body.innerHTML = `<div class="pagination-links"><a href="/destination/" rel="${rel}"><svg data-arrow></svg><span>Direction<br><span class="link-title">Title</span></span></a></div>`;
      const link = document.querySelector('a')!;
      const arrow = link.querySelector('svg')!;
      const label = link.querySelector('span')!;
      const before = Array.from(link.childNodes);
      const source = label.firstChild!;
      const selection = document.getSelection()!;
      const release = initSiteNativeControls();
      releases.push(release);
      for (const family of ['shadcn', 'brutalist', 'shadcn']) {
        const endpoint = family === 'brutalist' ? label : source;
        const offset = endpoint === label ? 1 : 2;
        selection.setBaseAndExtent(endpoint, offset, endpoint, offset);
        document.documentElement.dataset.siteLibraryFamily = family;
        await settle();
        expect(selection.anchorNode).toBe(endpoint);
        expect(selection.anchorOffset).toBe(offset);
        const surface = link.firstElementChild!;
        expect(surface.hasAttribute('data-site-link-content')).toBe(true);
        expect(surface.localName).toBe(`wc-site-${family}-surface`);
        expect(surface.firstElementChild).toBe(arrow);
        expect(label.parentElement?.parentElement).toBe(surface);
        expect(label.parentElement?.hasAttribute('data-site-link-text')).toBe(true);
        expect(link.getAttribute('rel')).toBe(rel);
        expect(link.querySelectorAll('svg')).toHaveLength(1);
        expect(link.textContent).toBe('DirectionTitle');
      }
      release();
      expect(Array.from(link.childNodes)).toEqual(before);
    }
  );

  it('projects TOC in-view/current facts without changing them and retains family across updates', async () => {
    document.body.innerHTML =
      '<sl-toc><a href="#section" data-site-native-link data-site-link-appearance="toc"><span>Section</span></a></sl-toc>';
    const link = document.querySelector('a')!;
    document.documentElement.dataset.siteLibraryFamily = 'brutalist';
    releases.push(initSiteNativeControls());
    await settle();
    const tokens = () => link.querySelector('[data-pui-root]')!.getAttribute('data-pui-style')!;
    expect(tokens()).not.toContain('bg-main');
    link.setAttribute('in-view', '');
    await settle();
    expect(tokens()).not.toContain('bg-main');
    expect(tokens()).toContain('rounded-base');
    expect(link.hasAttribute('aria-current')).toBe(false);
    link.setAttribute('aria-current', 'true');
    link.removeAttribute('in-view');
    await settle();
    expect(tokens()).toContain('bg-main');
    link.removeAttribute('aria-current');
    await settle();
    expect(tokens()).not.toContain('bg-main');
    link.dispatchEvent(new Event('pointerenter'));
    await settle();
    expect(tokens()).toContain('rounded-base');
    expect(link.getAttribute('href')).toBe('#section');
  });

  it('keeps old link skin only as fallback and makes pagination projection explicit', () => {
    const css = (name: string) =>
      readFileSync(new NodeURL(`../styles/${name}.css`, import.meta.url), 'utf8');
    expect(css('site-native-links')).toContain('a[data-site-link-enhanced]');
    expect(css('site-native-links')).toContain('[data-site-pagination-caption]');
    expect(css('site-native-links')).toContain('> [data-site-link-content]');
    expect(css('sidebar')).not.toContain(".top-level a[aria-current='page']");
    expect(css('site-library-family')).not.toContain('.right-sidebar a[in-view]');
    const toc = readFileSync(
      new NodeURL('./override/TableOfContents/starlight-toc.ts', import.meta.url),
      'utf8'
    );
    expect(toc).not.toContain('_highlightEl');
    expect(toc).toContain("setAttribute('in-view', '')");
    expect(toc).toContain("setAttribute('aria-current', 'true')");
  });
});

it('keeps the native summary, caret and browser-owned disclosure through family replacement and release', async () => {
  document.body.innerHTML =
    '<div class="sidebar-pane"><ul class="top-level"><li><details><summary><span class="group-label">Original group</span><svg class="caret"></svg></summary><a href="/original/">Original page</a></details></li></ul></div>';
  const details = document.querySelector('details')!;
  const summary = document.querySelector('summary')!;
  const label = summary.querySelector('.group-label')!;
  const caret = summary.querySelector('svg')!;
  const original = [...summary.childNodes];
  const release = initSiteNativeControls();
  releases.push(release);
  for (const family of ['shadcn', 'brutalist', 'shadcn']) {
    document.documentElement.dataset.siteLibraryFamily = family;
    await settle();
    expect(summary.firstElementChild!.localName).toBe(`wc-site-${family}-surface`);
    expect(summary.querySelector('svg')).toBe(caret);
    expect(summary.querySelector('.group-label')).toBe(label);
    expect(summary.querySelector('button,a,[tabindex],[role="button"]')).toBeNull();
    expect(summary.textContent).toBe('Original group');
    expect(summary.parentElement).toBe(details);
    const wasOpen = details.open;
    summary.click();
    expect(details.open).toBe(!wasOpen);
    summary.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await settle();
    expect(summary.firstElementChild!.getAttribute('data-pui-style')).toContain('translate-y-px');
    summary.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    await settle();
    expect(summary.firstElementChild!.getAttribute('data-pui-style')).not.toContain(
      'translate-y-px'
    );
    expect(summary.firstElementChild!.getAttribute('data-pui-style')!.includes('border-b-2')).toBe(
      family === 'brutalist'
    );
  }
  release();
  expect([...summary.childNodes]).toEqual(original);
  expect(summary.hasAttribute('data-site-link-enhanced')).toBe(false);
  summary.dispatchEvent(new Event('pointerenter'));
  expect([...summary.childNodes]).toEqual(original);
});
