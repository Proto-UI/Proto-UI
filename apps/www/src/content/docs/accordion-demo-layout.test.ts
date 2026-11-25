import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDemo } from '../../components/PrototypePreviewer/demo-renderer';
import { planMaterialStages } from '../../components/PrototypePreviewer/demo-material-stages';
import { loadPrototypes } from '../../components/PrototypePreviewer/prototype-modules';
import { createAccordionDemo } from './accordion-demo.shared';
import type { DemoChild, DemoNode } from '../../components/PrototypePreviewer/demo-types';

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

describe('Accordion demo narrow-width ownership', () => {
  for (const family of ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass']) {
    it(`${family} constrains the recipe grid, preserves long content, and wraps its action label`, () => {
      const root = createAccordionDemo(family).root;
      expect(root.kind).toBe('box');
      if (root.kind !== 'box') throw new Error('Expected recipe layout box');
      expect(root.className?.split(' ')).toContain('grid-cols-1');
      const all = (node: DemoChild): DemoChild[] =>
        typeof node === 'string' || node.kind === 'text'
          ? [node]
          : [node, ...(node.children ?? []).flatMap(all)];
      const nodes = all(root);
      for (const node of nodes) {
        if (
          typeof node !== 'string' &&
          node.kind === 'proto' &&
          node.prototypeId.endsWith('-accordion-trigger')
        )
          expect(node.className?.split(' ')).toContain('wrap-anywhere');
      }
      const long = nodes.find(
        (node) =>
          typeof node !== 'string' &&
          node.kind === 'box' &&
          node.children?.some(
            (child) =>
              typeof child === 'string' &&
              child.startsWith('Reach us anytime via support@example.com')
          )
      );
      expect(
        long && typeof long !== 'string' && long.kind === 'box' && long.className?.split(' ')
      ).toContain('wrap-anywhere');
      const accept = nodes.find(
        (node) => typeof node !== 'string' && node.kind === 'proto' && node.ref === 'accept'
      );
      expect(
        accept &&
          typeof accept !== 'string' &&
          accept.kind === 'proto' &&
          accept.className?.split(' ')
      ).toEqual(
        expect.arrayContaining([
          'min-w-0',
          'max-w-full',
          'h-auto',
          'whitespace-normal',
          'wrap-anywhere',
        ])
      );
    });
  }
});

describe('Liquid Accordion bounded source ownership', () => {
  const nodes = (node: DemoChild): DemoNode[] =>
    typeof node === 'string'
      ? []
      : node.kind === 'text'
        ? [node]
        : [node, ...(node.children ?? []).flatMap(nodes)];
  const byRef = (root: DemoChild, ref: string) => {
    const node = nodes(root).find((node) => node.kind !== 'text' && node.ref === ref);
    if (!node || node.kind === 'text') throw new Error(`Missing authored ref ${ref}`);
    return node;
  };

  it('bounds the four complete examples without splitting nested or controlled ownership', () => {
    const demo = createAccordionDemo('liquid-glass');
    const plans = planMaterialStages(demo.root);
    expect(plans).toHaveLength(4);
    const flows = plans.map((plan) => {
      const scope = byRef(demo.root, plan.scopeRef);
      const flow = byRef(scope, plan.mountRef);
      const overlay = byRef(scope, plan.overlayRef);
      expect(scope.kind).toBe('box');
      expect(flow.kind).toBe('box');
      expect(overlay.kind).toBe('box');
      expect(overlay.children).toEqual([]);
      expect(nodes(flow)).not.toContain(overlay);
      // The source's own 2rem padding is smaller than the Trigger footprint at
      // its maximum width. Preserve the recipe's inner gutter in every source.
      expect(flow.className?.split(' ')).toEqual(
        expect.arrayContaining(['grid-cols-1', 'min-w-0', 'p-2'])
      );
      expect(`${scope.className ?? ''} ${flow.className ?? ''}`).not.toMatch(
        /\b(?:overflow(?:-[xy])?-(?:auto|hidden|scroll)|max-h-\S+|h-\S+)\b/
      );
      return flow;
    });
    expect(
      flows.map((flow) =>
        nodes(flow).flatMap((node) =>
          node.kind === 'proto' && node.prototypeId === 'liquid-glass-accordion-root'
            ? [node.ref]
            : []
        )
      )
    ).toEqual([['single', 'nested'], ['multiple'], ['rtl'], ['controlled']]);

    const overview = byRef(flows[0], 'single-overview-content');
    const nested = byRef(flows[0], 'nested');
    expect(nodes(overview)).toContain(nested);
    expect(byRef(nested, 'nested-overview-trigger')).toBe(
      byRef(demo.root, 'nested-overview-trigger')
    );
    expect(byRef(flows[0], 'single-lifetime-item')).toBe(byRef(demo.root, 'single-lifetime-item'));
    expect(
      nodes(flows[3]).flatMap((node) =>
        node.kind !== 'text' && ['controlled', 'requestStatus', 'accept'].includes(node.ref ?? '')
          ? [node.ref]
          : []
      )
    ).toEqual(['controlled', 'requestStatus', 'accept']);
  });

  it('keeps other families in unsegmented example order through their layout wrappers', () => {
    for (const family of ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2']) {
      const root = createAccordionDemo(family).root;
      expect(planMaterialStages(root)).toEqual([]);
      if (root.kind !== 'box') throw new Error('Expected recipe layout box');
      expect(
        nodes(root).flatMap((node) =>
          node.kind !== 'text' &&
          ['single', 'multiple', 'rtl', 'controlled', 'requestStatus', 'accept'].includes(
            node.ref ?? ''
          )
            ? [node.ref]
            : []
        )
      ).toEqual(['single', 'multiple', 'rtl', 'controlled', 'requestStatus', 'accept']);
    }
  });
});
