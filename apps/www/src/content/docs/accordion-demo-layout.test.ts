import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDemo } from '../../components/PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../../components/PrototypePreviewer/prototype-modules';
import { createAccordionDemo } from './accordion-demo.shared';
import type { DemoChild } from '../../components/PrototypePreviewer/demo-types';

vi.mock('../../components/PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('../../components/PrototypePreviewer/runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('../../components/PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const current =
    await original<typeof import('../../components/PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...current, loadVue2: async () => require('vue') };
});

// Only framework CDN acquisition is replaced. These real-Adapter host tests
// prove authored display inputs and presence, not browser cascade or geometry.
afterEach(() => document.body.replaceChildren());
function contentNodes(node: DemoChild): Array<Extract<DemoChild, { kind: 'proto' }>> {
  if (typeof node === 'string' || node.kind === 'text') return [];
  return [
    ...(node.kind === 'proto' && node.prototypeId.endsWith('-accordion-content') ? [node] : []),
    ...(node.children ?? []).flatMap(contentNodes),
  ];
}

describe('Base Accordion content layout across runtime hosts', () => {
  it('keeps the layout override in the Base recipe without replacing family-owned styling', () => {
    for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass']) {
      const contents = contentNodes(createAccordionDemo(family).root);
      expect(contents.length).toBeGreaterThan(1);
      for (const content of contents) expect(content.className).toBeUndefined();
    }
  });

  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime} restores open block layout without overriding closed retained content`, async () => {
      await loadPrototypes(
        ['root', 'item', 'heading', 'trigger', 'content']
          .map((role) => `base-accordion-${role}`)
          .concat('base-button')
      );
      const host = document.createElement('div');
      document.body.append(host);
      const demo = createAccordionDemo('base');
      const rendered = await renderDemo({ runtime, host, demo });
      const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`);
      const assertOpen = (name: string) => {
        const content = ref(name)!;
        expect(content, name).not.toBeNull();
        expect(content.hasAttribute('data-open'), name).toBe(true);
        expect(content.getAttribute('aria-hidden'), name).toBe('false');
        expect(content.classList.contains('data-[open]:block'), name).toBe(true);
        expect(content.classList.contains('p-3'), name).toBe(true);
        // An unconditional utilities-layer block would override the Prototype's
        // lower-layer hidden selector for keepMounted content.
        expect(content.classList.contains('block'), name).toBe(false);
        expect(content.style.display, name).toBe('');
      };
      const assertRetainedHidden = (name: string) => {
        const content = ref(name)!;
        expect(content, name).not.toBeNull();
        expect(content.hasAttribute('data-open'), name).toBe(false);
        expect(content.hasAttribute('data-hidden'), name).toBe(true);
        expect(content.getAttribute('aria-hidden'), name).toBe('true');
        expect(content.getAttribute('data-pui-style'), name).toContain('data-[hidden]:hidden');
        expect(content.classList.contains('block'), name).toBe(false);
      };
      try {
        await vi.waitFor(() => assertOpen('single-overview-content'));
        assertRetainedHidden('multiple-b-content');
        ref('nested-overview-trigger')!.click();
        await vi.waitFor(() => assertOpen('nested-overview-content'));
        ref('nested-overview-trigger')!.click();
        await vi.waitFor(() =>
          expect(ref('nested-overview-trigger')?.getAttribute('aria-expanded')).toBe('false')
        );
        ref('multiple-b-trigger')!.click();
        await vi.waitFor(() => assertOpen('multiple-b-content'));
        ref('multiple-a-trigger')!.click();
        await vi.waitFor(() => {
          assertRetainedHidden('multiple-a-content');
          assertOpen('multiple-b-content');
        });
        ref('multiple-a-trigger')!.click();
        await vi.waitFor(() => assertOpen('multiple-a-content'));
        ref('multiple-b-trigger')!.click();
        await vi.waitFor(() => {
          assertOpen('multiple-a-content');
          assertRetainedHidden('multiple-b-content');
        });
      } finally {
        await rendered.destroy();
      }
    }, 20000);
  }
});
