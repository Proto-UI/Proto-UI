import { initLibraryLiquidCardCandidate } from './library-liquid-card-client';
import { describe, it, expect } from 'vitest';
import { initLibraryCards } from './library-card-client';
import { snapshotLibraryPart } from './library-card-snapshot';
import {
  libraryCardPrototypes,
  librarySurfaceProps,
  libraryBodyPropsForFamily,
  libraryCaptionPropsForFamily,
  type LibraryPart,
} from './library-card-prototypes';
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
describe('real library card enhancement', () => {
  it.each(Object.keys(libraryCardPrototypes) as LibraryPart[])(
    'keeps server/client tokens and exact native children for %s',
    async (part) => {
      const props = part.endsWith('surface') ? librarySurfaceProps : {};
      const tokens = await snapshotLibraryPart(part, props);
      const owner = document.createElement('article');
      const element = document.createElement(`wc-library-${part}`);
      element.dataset.libraryPart = part;
      element.dataset.libraryProps = JSON.stringify(props);
      if (tokens.length) element.setAttribute('data-pui-style', tokens.join(' '));
      const anchor = document.createElement('a');
      anchor.href = '/zh-cn/ui-libraries/';
      anchor.textContent = 'Library';
      element.append(anchor);
      owner.append(element);
      document.body.append(owner);
      initLibraryCards(owner);
      await flush();
      expect(
        (element.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean).sort()
      ).toEqual([...tokens].sort());
      expect(element.hasAttribute('data-pui-style')).toBe(tokens.length > 0);
      expect(owner.querySelector('a')).toBe(anchor);
      expect(element.tabIndex).toBe(-1);
      expect(element.hasAttribute('role')).toBe(false);
      owner.remove();
      await flush();
    }
  );
});

it('observes native focus and pointer state without owning navigation, and releases observers', async () => {
  const owner = document.createElement('article');
  const link = document.createElement('a');
  link.href = '/target';
  link.dataset.libraryAction = '';
  const surface = document.createElement('wc-library-shadcn-surface');
  surface.dataset.libraryPart = 'shadcn-surface';
  surface.dataset.libraryProps = JSON.stringify({
    variant: 'solid',
    radius: 'default',
    border: 'all',
    elevation: 'raised',
  });
  surface.textContent = 'Explore';
  link.append(surface);
  owner.append(link);
  document.body.append(owner);
  const release = initLibraryCards(owner);
  await flush();
  link.dispatchEvent(new Event('pointerenter'));
  await flush();
  expect(surface.getAttribute('data-pui-style')).toContain('bg-primary/80');
  let prevented = false;
  link.addEventListener('click', (event) => {
    prevented = event.defaultPrevented;
  });
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  expect(prevented).toBe(false);
  expect(link.getAttribute('href')).toBe('/target');
  release();
  link.dispatchEvent(new Event('pointerenter'));
  await flush();
  expect(surface.getAttribute('data-pui-style')).not.toContain('bg-primary/80');
  owner.remove();
});

it('keeps the candidate native action recipe when projecting native facts', async () => {
  const owner = document.createElement('article'),
    link = document.createElement('a');
  link.href = '/liquid-glass/';
  link.dataset.libraryAction = '';
  const surface = document.createElement('wc-library-liquid-optical-surface');
  surface.dataset.libraryPart = 'liquid-glass-surface';
  surface.dataset.libraryProps = JSON.stringify({
    variant: 'outline',
    radius: 'full',
    border: 'none',
    elevation: 'none',
  });
  surface.textContent = 'Explore Liquid Glass';
  link.append(surface);
  owner.append(link);
  document.body.append(owner);
  const release = initLibraryLiquidCardCandidate(owner);
  await flush();
  const rendered = link.querySelector<HTMLElement>('wc-library-liquid-optical-surface')!;
  expect(rendered.getAttribute('data-pui-style')).toContain('rounded-full');
  link.dispatchEvent(new Event('pointerenter'));
  await flush();
  expect(rendered.getAttribute('data-pui-style')).toContain('bg-muted');
  expect(rendered.getAttribute('data-pui-style')).not.toContain('bg-primary');
  expect(link.hasAttribute('tabindex')).toBe(false);
  expect(link.localName).toBe('a');
  expect(rendered.tabIndex).toBe(-1);
  expect(rendered.hasAttribute('role')).toBe(false);
  expect(link.getAttribute('href')).toBe('/liquid-glass/');
  release();
  owner.remove();
  await flush();
});

it.each(['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const)(
  'preserves the %s body/caption weight recipe through real WC enhancement',
  async (family) => {
    const owner = document.createElement('article');
    for (const props of [libraryBodyPropsForFamily(family), libraryCaptionPropsForFamily(family)]) {
      const element = document.createElement(`wc-library-${family}-text`);
      element.dataset.libraryPart = `${family}-text`;
      element.dataset.libraryProps = JSON.stringify(props);
      element.textContent = 'Family text';
      const tokens = await snapshotLibraryPart(`${family}-text`, props);
      element.setAttribute('data-pui-style', tokens.join(' '));
      owner.append(element);
    }
    document.body.append(owner);
    const release = initLibraryCards(owner);
    await flush();
    for (const element of owner.children) {
      const tokens = element.getAttribute('data-pui-style')!.split(/\s+/);
      expect(tokens.filter((token) => /^font-(normal|medium|semibold|bold)$/.test(token))).toEqual([
        family === 'brutalist' ? 'font-medium' : 'font-normal',
      ]);
    }
    release();
    owner.remove();
    await flush();
  }
);
