import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createHomepageContent } from './homepage-runtime-client';

const controls = [
  {
    name: 'brand',
    parent: '',
    attrs: 'data-home-brand data-home-action-variant="minimal"',
    appearance: 'brand',
  },
  {
    name: 'whitepaper',
    parent: 'data-site-header-desktop-navigation',
    attrs: 'data-home-action-variant="minimal"',
    appearance: 'nav',
  },
  {
    name: 'start',
    parent: '',
    attrs: 'data-site-link-appearance="action" data-home-action-variant="primary"',
    appearance: 'action',
  },
  {
    name: 'demo',
    parent: '',
    attrs: 'data-site-link-appearance="action" data-home-action-variant="secondary"',
    appearance: 'action',
  },
  {
    name: 'announcement',
    parent: 'class="homepage-hero__eyebrow"',
    attrs: 'data-home-action-variant="minimal"',
    appearance: 'text',
  },
] as const;

afterEach(() => document.body.replaceChildren());

describe('Homepage native focus paint ownership', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    for (const family of ['shadcn', 'brutalist'] as const) {
      for (const control of controls) {
        it(`${family}/${runtime}/${control.name} carries resolved appearance without moving native semantics`, () => {
          document.body.innerHTML = `<div ${control.parent}><a href="/docs/?q=1#part" target="_blank" rel="noopener" aria-label="Original link" ${control.attrs}>Original label</a></div>`;
          const root = document.querySelector<HTMLElement>('div')!;
          const link = root.querySelector('a')!;
          const before = link.outerHTML;
          const demo = createHomepageContent(
            {
              root,
              mount: root,
              fallback: root,
              ownerId: 'focus-owner',
              links: [link],
              theme: false,
              runtime: false,
            },
            runtime,
            () => true,
            family
          );
          if (demo.root.kind !== 'box') throw new Error('Expected composition root');
          const anchor = demo.root.children![0];
          if (typeof anchor === 'string' || anchor.kind !== 'box')
            throw new Error('Expected native anchor');
          expect(anchor.tag).toBe('a');
          expect(anchor.attrs).toMatchObject({
            href: '/docs/?q=1#part',
            target: '_blank',
            rel: 'noopener',
            'aria-label': 'Original link',
            'data-site-link-enhanced': 'true',
            'data-site-link-appearance': control.appearance,
          });
          expect(anchor.attrs).not.toHaveProperty('role');
          expect(anchor.attrs).not.toHaveProperty('tabindex');
          const surface = anchor.children![0];
          if (typeof surface === 'string' || surface.kind !== 'proto')
            throw new Error('Expected passive Surface');
          expect(surface.prototypeId).toBe(`${family}-surface-root`);
          expect(surface.props?.focusVisible).toBe(false);
          // Recipe preparation must not disable the fallback's native focus.
          expect(link.outerHTML).toBe(before);
          expect(link.hasAttribute('data-site-link-enhanced')).toBe(false);
        });
      }
    }
  }

  it('limits duplicate-outline reset to known enhanced Homepage appearances', () => {
    const css = readFileSync('apps/www/src/styles/site-native-links.css', 'utf8');
    const rule = css.match(
      /(a\.home-runtime-link\[data-site-link-enhanced='true'\]:is\([^}]+?\))\s*\{([^}]+)\}/
    );
    expect(rule).not.toBeNull();
    const selector = rule![1];
    expect(rule![2].trim()).toBe('outline: none;');
    for (const { appearance } of controls) {
      const link = document.createElement('a');
      link.href = '/docs/';
      link.className = 'home-runtime-link';
      link.dataset.siteLinkAppearance = appearance;
      expect(link.matches(selector)).toBe(false);
      link.dataset.siteLinkEnhanced = 'true';
      expect(link.matches(selector)).toBe(true);
      link.dataset.siteLinkEnhanced = 'false';
      expect(link.matches(selector)).toBe(false);
    }
    const unrelated = document.createElement('a');
    unrelated.dataset.siteLinkEnhanced = 'true';
    unrelated.dataset.siteLinkAppearance = 'action';
    expect(unrelated.matches(selector)).toBe(false);
    unrelated.className = 'home-runtime-link';
    unrelated.dataset.siteLinkAppearance = 'unknown';
    expect(unrelated.matches(selector)).toBe(false);
  });
});
