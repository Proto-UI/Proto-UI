import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve(process.cwd(), 'packages/adapters/react/package.json'));
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
import { createHomepageShowcase } from './homepage-showcase';
import { createProjectionComposition } from '../PrototypePreviewer/projection-composition';
import { loadPrototypes } from '../PrototypePreviewer/prototype-modules';
import { renderDemo } from '../PrototypePreviewer/demo-renderer';
let destroy: (() => Promise<void> | void) | undefined;
afterEach(async () => {
  await destroy?.();
  destroy = undefined;
  document.body.replaceChildren();
});
for (const runtime of ['wc', 'react'] as const)
  for (const family of ['shadcn', 'brutalist'] as const)
    it(`${family}/${runtime} real gallery keeps every declared physical part in the owning generation`, async () => {
      const content = createHomepageShowcase(family, runtime, 'en', () => true);
      await loadPrototypes([...content.recipe.prototypeIds]);
      const composition = createProjectionComposition({
        ownerId: `gallery-${family}`,
        runtimeId: runtime,
        projectionFamilyId: family,
        generation: 3,
        componentId: 'button',
        controlIds: [],
        controls: {
          runtime: {
            label: 'Runtime',
            options: [{ value: 'wc', label: 'Web Components' }],
            onValueChange() {},
          },
          family: {
            label: 'Library',
            options: [{ value: family, label: family }],
            onValueChange() {},
          },
          component: { label: 'Unused', options: [], onValueChange() {} },
        },
        childDemo: content.demo,
        contentRecipe: content.recipe,
      });
      const host = document.createElement('div');
      document.body.append(host);
      const rendered = await renderDemo({ runtime, demo: composition.demo, host });
      destroy = rendered.destroy;
      composition.setLocked(false);
      for (let i = 0; i < 30; i++) await Promise.resolve();
      const actual = [
        ...document.querySelectorAll<HTMLElement>(
          `[data-projection-owner="gallery-${family}"].pui-projection-prototype`
        ),
      ];
      const counts: Record<string, number> = {};
      for (const element of actual) {
        const id = element.dataset.projectionPrototype!;
        counts[id] = (counts[id] ?? 0) + 1;
        expect(element.dataset.projectionGeneration).toBe('3');
      }
      const expected: Record<string, number> = {};
      const visit = (node: any) => {
        if (typeof node !== 'object' || !node) return;
        if (node.kind === 'proto')
          expected[node.prototypeId] = (expected[node.prototypeId] ?? 0) + 1;
        for (const child of node.children ?? []) visit(child);
      };
      visit(content.demo.root);
      expect(counts).toEqual(expected);
    });
