// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { assertDemoSpec, type DemoNode, type DemoSpec } from './demo-types';
import { createSurfaceAtomDemo } from './surface-atom-demo';
import { createTextAtomDemo } from './text-atom-demo';

function atoms(demo: DemoSpec): DemoNode[] {
  if (demo.root.kind !== 'box') throw new Error('Expected consumer-owned layout');
  const collect = (node: DemoNode): DemoNode[] => {
    if (node.kind !== 'box') return [node];
    return (node.children ?? []).flatMap((child) =>
      typeof child === 'string' ? [] : collect(child)
    );
  };
  return collect(demo.root);
}

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
      // Bootstrap adds blue-frame navigation and Button-context comparisons;
      // Liquid Glass adds its explicit material opt-in.
      expect(atoms(demo)).toHaveLength(
        family === 'bootstrap-2-3-2' ? 10 : family === 'liquid-glass' ? 5 : 4
      );
      for (const node of atoms(demo)) {
        if (node.kind !== 'proto') throw new Error('Expected the actual Surface atom');
        expect(node.prototypeId).toBe(`${family}-surface-root`);
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
              'material',
              ...(family === 'bootstrap-2-3-2' ? ['actionProfile', 'colorContext'] : []),
            ].includes(key)
          )
        ).toBe(true);
      }
    });
  }
});
