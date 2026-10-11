import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDemo } from '../PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../PrototypePreviewer/prototype-modules';
import { createHomepageShowcase } from './homepage-showcase';
import { composeHomepageText } from './homepage-text';
import type { DemoNode } from '../PrototypePreviewer/demo-types';

// Real four-Adapter rendering, with only CDN acquisition replaced by installed
// framework versions. This proves display ownership, not native line geometry.
vi.mock('../PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('../PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('../PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const current = await original<typeof import('../PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...current, loadVue2: async () => require('vue') };
});

afterEach(() => document.body.replaceChildren());

describe('Homepage block text layout across runtime hosts', () => {
  it('leaves unrelated inline text and its surrounding sentence unchanged', () => {
    const inline: DemoNode = {
      kind: 'proto',
      prototypeId: 'shadcn-text-root',
      rootTag: 'span',
      surfaceStyle: { display: 'inline' },
      children: ['inline emphasis'],
    };
    const sentence: DemoNode = {
      kind: 'box',
      tag: 'span',
      children: ['Before ', inline, ' after'],
    };
    expect(composeHomepageText(sentence, 'shadcn')).toEqual(sentence);
  });

  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
      it(`${family}/${runtime} preserves the block text formatting context`, async () => {
        // P-BASE-TEXT-CONTENT/PASSIVE leave layout with the consumer. Runtime
        // selection alone must not exchange that layout for an inline strut.
        const content = createHomepageShowcase(family, runtime, 'zh-cn', () => true);
        await loadPrototypes([...content.recipe.prototypeIds]);
        const host = document.createElement('div');
        document.body.append(host);
        const rendered = await renderDemo({ runtime, host, demo: content.demo });
        try {
          const owners = [...host.querySelectorAll<HTMLElement>('[data-home-text]')];
          expect(owners.length).toBeGreaterThan(20);
          for (const owner of owners) {
            const surface = owner.firstElementChild as HTMLElement;
            expect(surface.hasAttribute('data-pui-root'), owner.className).toBe(true);
            expect(getComputedStyle(surface).display, `${owner.className}/${surface.tagName}`).toBe(
              'block'
            );
            expect(surface.hasAttribute('role')).toBe(false);
            expect(surface.hasAttribute('tabindex')).toBe(false);
            expect(surface.querySelector('[data-home-text-slot]')).not.toBeNull();
          }
        } finally {
          await rendered.destroy();
          host.remove();
        }
      }, 20_000);
    }
  }
});
