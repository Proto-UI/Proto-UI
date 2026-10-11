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
// exercise terminal owner order, retained presence and remount. Vitest keeps
// every unhandled lifecycle error fatal; native paint remains separate evidence.
afterEach(() => document.body.replaceChildren());
function contentNodes(node: DemoChild): Array<Extract<DemoChild, { kind: 'proto' }>> {
  if (typeof node === 'string' || node.kind === 'text') return [];
  return [
    ...(node.kind === 'proto' && node.prototypeId.endsWith('-accordion-content') ? [node] : []),
    ...(node.children ?? []).flatMap(contentNodes),
  ];
}

describe('Nested Accordion terminal lifetime across real runtime hosts', () => {
  it('keeps the layout override in the Base recipe without replacing family-owned styling', () => {
    for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass']) {
      const contents = contentNodes(createAccordionDemo(family).root);
      expect(contents.length).toBeGreaterThan(1);
      for (const content of contents) expect(content.className).toBeUndefined();
    }
  });

  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime} closes and reopens nested owners without transient duplicate parts`, async () => {
      await loadPrototypes(
        ['root', 'item', 'heading', 'trigger', 'content']
          .map((role) => `base-accordion-${role}`)
          .concat('base-button')
      );
      const host = document.createElement('div');
      document.body.append(host);
      const demo = createAccordionDemo('base');
      // Preserve the original pre-spacing recipe as an independent control.
      for (const content of contentNodes(demo.root)) content.className = 'p-3';
      const rendered = await renderDemo({ runtime, host, demo });
      const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`);
      const assertOpen = (name: string) => {
        const content = ref(name)!;
        expect(content, name).not.toBeNull();
        expect(content.hasAttribute('data-open'), name).toBe(true);
        expect(content.getAttribute('aria-hidden'), name).toBe('false');
        expect(content.className, name).toBe('p-3');
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
        for (let cycle = 0; cycle < 3; cycle++) {
          ref('nested-overview-trigger')!.click();
          await vi.waitFor(() => assertOpen('nested-overview-content'));
          ref('nested-overview-trigger')!.click();
          await vi.waitFor(() =>
            expect(ref('nested-overview-trigger')?.getAttribute('aria-expanded')).toBe('false')
          );
          ref('single-overview-trigger')!.click();
          await vi.waitFor(() => {
            expect(ref('single-overview-trigger')?.getAttribute('aria-expanded')).toBe('false');
            const content = ref('single-overview-content');
            // WC retains the physical carrier; React/Vue/Vue2 detach their host.
            expect(!content || content.hasAttribute('data-pui-view-detached')).toBe(true);
          });
          ref('single-overview-trigger')!.click();
          await vi.waitFor(() => assertOpen('single-overview-content'));
        }
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
