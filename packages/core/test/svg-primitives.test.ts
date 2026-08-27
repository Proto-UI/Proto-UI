import { describe, expect, it } from 'vitest';
import { createRendererPrimitives } from '@proto.ui/core';

describe('core template svg primitives (v0)', () => {
  it('builds svg nodes under renderer.svg namespace', () => {
    const { svg } = createRendererPrimitives();

    const node = svg.root(
      { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
      [svg.path({ d: 'M6 9l6 6 6-6' })]
    );

    expect(node.kind).toBe('svg-node');
    expect(node.tag).toBe('svg');
    expect(node.props.viewBox).toBe('0 0 24 24');
    expect(node.children).toEqual({
      kind: 'svg-node',
      tag: 'path',
      props: { d: 'M6 9l6 6 6-6' },
      children: null,
    });
  });

  it('lets a decorative glyph hide its root from the accessibility tree', () => {
    const { svg } = createRendererPrimitives();

    const node = svg.root({ viewBox: '0 0 24 24', 'aria-hidden': 'true' });

    expect(node.props['aria-hidden']).toBe('true');
    // Only the root hides a drawing, so the leaves keep rejecting it.
    expect(() => svg.path({ d: 'M0 0', 'aria-hidden': 'true' } as any)).toThrow(
      "[Template][SVG] path does not support prop 'aria-hidden'."
    );
  });

  it('rejects unknown svg props', () => {
    const { svg } = createRendererPrimitives();
    expect(() => svg.path({ d: 'M0 0', foo: 'x' } as any)).toThrow(
      "[Template][SVG] path does not support prop 'foo'."
    );
  });

  it('enforces required svg props', () => {
    const { svg } = createRendererPrimitives();
    expect(() => svg.root({} as any)).toThrow(
      "[Template][SVG] svg requires non-empty prop 'viewBox'."
    );
    expect(() => svg.circle({ cx: 12, cy: 12 } as any)).toThrow(
      "[Template][SVG] circle requires non-empty prop 'r'."
    );
  });
});
