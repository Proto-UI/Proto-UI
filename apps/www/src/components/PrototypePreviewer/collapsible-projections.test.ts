import { describe, expect, it } from 'vitest';
import { assertDemoSpec, type DemoNode } from './demo-types';
import { PROJECTION_FAMILY_MANIFESTS } from './projection-families';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import shadcn from '../../content/docs/demo-shadcn-collapsible.demo';
import brutalist from '../../content/docs/demo-brutalist-collapsible.demo';
import bootstrap from '../../content/docs/demo-bootstrap-2-3-2-collapsible.demo';
import glass from '../../content/docs/demo-liquid-glass-collapsible.demo';

for (const [family, demo] of [
  ['shadcn', shadcn],
  ['brutalist', brutalist],
  ['bootstrap-2-3-2', bootstrap],
  ['liquid-glass', glass],
] as const) {
  describe(`${family}: real Collapsible DemoSpec`, () => {
    it('uses the exact registered parts and a separate family acceptance action', async () => {
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = new Set<string>();
      const nodes: Extract<DemoNode, { kind: 'proto' }>[] = [];
      const visit = (node: DemoNode) => {
        if (node.kind === 'text') return;
        if (node.kind === 'proto') {
          ids.add(node.prototypeId);
          nodes.push(node);
        }
        for (const child of node.children ?? []) if (typeof child !== 'string') visit(child);
      };
      visit(demo.root);
      expect(ids).toEqual(
        new Set(PROJECTION_FAMILY_MANIFESTS[family].families.collapsible.recipePrototypeIds)
      );
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id).name).toBe(id);
      }
      expect(
        nodes.filter((node) => node.prototypeId === `${family}-collapsible-root`)
      ).toHaveLength(4);
      for (const node of nodes.filter(
        (node) => node.prototypeId === `${family}-collapsible-trigger`
      )) {
        expect(node.children!.every((child) => typeof child === 'string')).toBe(true);
        expect(node.className).toBeUndefined();
      }
      expect(nodes.find((node) => node.ref === 'controlled')?.props).toEqual({ open: false });
      expect(nodes.find((node) => node.ref === 'disabled')?.props).toEqual({
        defaultOpen: true,
        disabled: true,
      });
    });
  });
}
