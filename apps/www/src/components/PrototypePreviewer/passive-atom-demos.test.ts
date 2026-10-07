// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertDemoSpec, type DemoNode, type DemoSpec } from './demo-types';
import { createSurfaceAtomDemo } from './surface-atom-demo';
import { createTextAtomDemo } from './text-atom-demo';

function atoms(demo: DemoSpec): DemoNode[] {
  if (demo.root.kind !== 'box') throw new Error('Expected consumer-owned layout');
  return (demo.root.children ?? []).filter((child): child is DemoNode => typeof child !== 'string');
}
const registry = readFileSync(new URL('./prototype-modules.ts', import.meta.url), 'utf8');

describe('Passive atom documentation recipes', () => {
  for (const family of [
    'base',
    'shadcn',
    'brutalist',
    'bootstrap-2-3-2',
    'liquid-glass',
  ] as const) {
    it(`${family} Text uses real public identities and only passive inputs`, () => {
      const demo = createTextAtomDemo(family);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      expect(demo.setup).toBeUndefined();
      expect(atoms(demo)).toHaveLength(4);
      for (const node of atoms(demo)) {
        expect(node.kind).toBe('proto');
        if (node.kind !== 'proto') throw new Error('Expected the actual Text atom');
        expect(node.prototypeId).toBe(`${family}-text-root`);
        expect(registry).toContain(`'${node.prototypeId}'`);
        expect(registry).toContain(`@proto.ui/prototypes-${family}/text`);
        expect(node.className).toBeUndefined();
        expect(node.surfaceStyle).toBeUndefined();
        expect(
          Object.keys(node.props ?? {}).every((key) =>
            [
              'size',
              'tone',
              'weight',
              'font',
              'leading',
              'tracking',
              'emphasis',
              'decoration',
            ].includes(key)
          )
        ).toBe(true);
      }
    });
  }
  for (const family of [
    'base',
    'shadcn',
    'brutalist',
    'bootstrap-2-3-2',
    'liquid-glass',
  ] as const) {
    it(`${family} Surface discloses explicit facts without inventing interaction`, () => {
      const demo = createSurfaceAtomDemo(family);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      expect(demo.setup).toBeUndefined();
      expect(atoms(demo)).toHaveLength(4);
      for (const node of atoms(demo)) {
        if (node.kind !== 'proto') throw new Error('Expected the actual Surface atom');
        expect(node.prototypeId).toBe(`${family}-surface-root`);
        expect(registry).toContain(`'${node.prototypeId}'`);
        expect(registry).toContain(`@proto.ui/prototypes-${family}/surface`);
        expect(node.className).toBeUndefined();
        expect(node.surfaceStyle).toBeUndefined();
        expect(
          Object.keys(node.props ?? {}).every((key) =>
            [
              'variant',
              'radius',
              'border',
              'elevation',
              'hovered',
              'focusVisible',
              'pressed',
              'current',
            ].includes(key)
          )
        ).toBe(true);
      }
    });
  }
});
