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
      const expected: Record<string, number> = {};
      const visit = (node: any) => {
        if (typeof node !== 'object' || !node) return;
        if (node.kind === 'proto')
          expected[node.prototypeId] = (expected[node.prototypeId] ?? 0) + 1;
        for (const child of node.children ?? []) visit(child);
      };
      visit(content.demo.root);
      const assertPhysical = (openBodies: number, elements?: HTMLElement[]) => {
        const actual =
          elements ??
          Array.from(
            document.querySelectorAll<HTMLElement>(
              `[data-projection-owner="gallery-${family}"].pui-projection-prototype`
            )
          );
        const counts: Record<string, number> = {};
        for (const element of actual) {
          const id = element.dataset.projectionPrototype!;
          counts[id] = (counts[id] ?? 0) + 1;
          expect(element.dataset.projectionGeneration).toBe('3');
        }
        // WC retains detached hosts and authored descendants. React withdraws
        // the content subtree. Both must preserve the exact active projection.
        const physical = { ...expected };
        if (runtime === 'react') {
          physical[`${family}-text-root`]! -= 3 - openBodies;
          if (openBodies) physical[`${family}-accordion-content`] = openBodies;
          else delete physical[`${family}-accordion-content`];
        }
        expect(counts).toEqual(physical);
        return actual;
      };
      const help = host.querySelector<HTMLElement>('[data-demo-ref="composition-help"]')!;
      const triggers = Array.from(help.querySelectorAll<HTMLElement>('[aria-expanded]'));
      const items = Array.from(
        help.querySelectorAll<HTMLElement>(`[data-projection-prototype="${family}-accordion-item"]`)
      );
      expect(triggers).toHaveLength(3);
      expect(items).toHaveLength(3);
      const openedIds = new Map<number, string>();
      const bodies = [
        'Choose a result in the step finder',
        'Use Tab to move focus',
        'This is an interactive example',
      ];
      const assertHelp = (open: number | null) => {
        for (let index = 0; index < 3; index++) {
          const trigger = triggers[index]!;
          const panels = Array.from(
            items[index]!.querySelectorAll<HTMLElement>(
              `[data-projection-prototype="${family}-accordion-content"]`
            )
          );
          expect(trigger.getAttribute('aria-expanded')).toBe(String(index === open));
          expect(panels).toHaveLength(index === open || runtime === 'wc' ? 1 : 0);
          if (index === open) {
            const panel = panels[0]!;
            expect(panel.id).not.toBe('');
            expect(trigger.id).not.toBe('');
            expect(document.querySelectorAll(`[id="${trigger.id}"]`)).toHaveLength(1);
            expect(document.querySelectorAll(`[id="${panel.id}"]`)).toHaveLength(1);
            expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
            expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);
            expect(panel.getAttribute('role')).toBe('region');
            expect(panel.querySelectorAll('.pui-projection-prototype')).toHaveLength(1);
            expect(panel.textContent?.trim()).toContain(bodies[index]);
            openedIds.set(index, panel.id);
            expect(new Set(openedIds.values()).size).toBe(openedIds.size);
          } else {
            expect(trigger.getAttribute('aria-controls')).toBeNull();
            if (runtime !== 'wc') continue;
            expect(panels[0]!.getAttribute('aria-labelledby')).toBeNull();
            if (panels[0]!.getAttribute('role') === 'region') {
              expect(panels[0]!.hidden).toBe(true);
              expect(panels[0]!.getAttribute('aria-hidden')).toBe('true');
            }
            expect(panels[0]!.id).toBe('');
            expect(panels[0]!.hasAttribute('data-pui-view-detached')).toBe(true);
          }
        }
        return assertPhysical(open === null ? 0 : 1);
      };
      const initial = assertHelp(0);
      expect(() => assertPhysical(1, initial.slice(1))).toThrow();
      expect(() => assertPhysical(1, [...initial, initial[0]!])).toThrow();
      for (const index of [1, 2, 0]) {
        triggers[index]!.click();
        for (let i = 0; i < 30; i++) await Promise.resolve();
        await vi.waitFor(() => assertHelp(index));
        triggers[index]!.click();
        for (let i = 0; i < 30; i++) await Promise.resolve();
        await vi.waitFor(() => assertHelp(null));
      }
      expect(openedIds.size).toBe(3);
    });
