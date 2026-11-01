import { describe, expect, it } from 'vitest';
import {
  createRendererPrimitives,
  normalizeChildren,
  type ElementFactory,
  type SvgFactories,
  type TemplateChild,
  type TemplateChildren,
  type TemplateChildrenInput,
  type TemplateNode,
} from '../src';

// Compiled by strict TypeScript, never executed. Canonical output is not recursive.
function authoringBoundary(el: ElementFactory, svg: SvgFactories, child: TemplateChild) {
  const nested: TemplateChildrenInput = [child, [null, [child, 'text', 0]]];
  const twoArgs: TemplateNode = el('section', nested);
  const threeArgs: TemplateNode = el('section', {}, nested);
  const svgRoot = svg.root({ viewBox: '0 0 10 10' }, nested);
  const svgGroup = svg.g({}, nested);
  const immutable = [child, [null, [child]]] as const;
  const immutableElement = el('section', immutable);
  const immutableSvg = svg.root({ viewBox: '0 0 10 10' }, immutable);
  const canonical: TemplateChildren = normalizeChildren(nested);
  // @ts-expect-error Undefined in a child position is not portable authoring input.
  el('section', [child, [undefined]]);
  // @ts-expect-error Boolean in a child position is not portable authoring input.
  el('section', {}, [child, [false]]);
  // @ts-expect-error SVG input retains the same undefined-child boundary.
  svg.root({ viewBox: '0 0 10 10' }, [[undefined]]);
  // @ts-expect-error SVG input retains the same boolean-child boundary.
  svg.g({}, [[true]]);
  // @ts-expect-error Readonly arrays must not admit child-position undefined either.
  el('section', [[undefined]] as const);
  // @ts-expect-error A canonical children value must not contain nested arrays.
  const notCanonical: TemplateChildren = [[child]];
  // @ts-expect-error A canonical node's children must not contain nested arrays.
  const notCanonicalNode: TemplateNode = { type: 'section', children: [[child]] };
  // @ts-expect-error A recursive input cannot be passed off as normalized output.
  const unnormalized: TemplateChildren = nested;
  // @ts-expect-error Ordinary objects are not portable TemplateChild values.
  el('section', [[{ hostObject: true }]]);
  return [
    twoArgs,
    threeArgs,
    svgRoot,
    svgGroup,
    immutableElement,
    immutableSvg,
    canonical,
    notCanonical,
    notCanonicalNode,
    unnormalized,
  ];
}
void authoringBoundary;

describe('recursive authoring input and flat canonical children', () => {
  it('normalizes nested el input without changing alias, slot, order or evaluation count', () => {
    const renderer = createRendererPrimitives();
    const child = renderer.el('span', 'A');
    const slot = renderer.slot();
    let calls = 0;
    const captured = () => {
      calls += 1;
      return child;
    };
    const input: TemplateChildrenInput = [child, [null, [captured()]], slot];
    const result = renderer.el('section', input);
    expect(calls).toBe(1);
    expect(result.children).toEqual([child, child, slot]);
    expect(Array.isArray(result.children)).toBe(true);
    if (!Array.isArray(result.children)) throw new Error('Expected flat canonical children');
    expect(result.children[0]).toBe(child);
    expect(result.children[1]).toBe(child);
    expect(result.children[2]).toBe(slot);
    expect(result.children.some(Array.isArray)).toBe(false);
    expect(input).toEqual([child, [null, [child]], slot]);
  });

  it('normalizes the props overload without dropping empty strings or zero', () => {
    const { el } = createRendererPrimitives();
    expect(el('section', {}, [['', [0]], null, ['tail']]).children).toEqual(['', 0, 'tail']);
  });

  it('reads readonly and frozen authoring arrays without mutating their structure', () => {
    const { el, svg } = createRendererPrimitives();
    const path = svg.path({ d: 'M0 0 L1 1' });
    const inner = Object.freeze([null, path] as const);
    const input = Object.freeze([path, inner] as const);
    expect(el('section', input).children).toEqual([path, path]);
    expect(svg.root({ viewBox: '0 0 10 10' }, input).children).toEqual([path, path]);
    expect(svg.g({}, input).children).toEqual([path, path]);
    expect(input[0]).toBe(path);
    expect(input[1]).toBe(inner);
    expect(inner[0]).toBeNull();
    expect(inner[1]).toBe(path);
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(inner)).toBe(true);
  });

  it('canonicalizes an all-empty input and a single surviving child', () => {
    const { el } = createRendererPrimitives();
    const child = el('span', 'only');
    expect(el('section', [[], [null, []]]).children).toBeNull();
    expect(el('section', [null, [[child]], []]).children).toBe(child);
    expect(el('section').children).toBeNull();
    expect(normalizeChildren(undefined)).toBeNull();
  });

  it('normalizes SVG root and group input at their existing factory boundaries', () => {
    const { svg } = createRendererPrimitives();
    const path = svg.path({ d: 'M0 0 L1 1' });
    const group = svg.g({}, [[path], [null, [path]]]);
    expect(group.children).toEqual([path, path]);
    const root = svg.root({ viewBox: '0 0 10 10' }, [null, [[group]]]);
    expect(root.children).toBe(group);
  });

  it('preserves undefined and boolean rejection at any nested child position', () => {
    const { el, svg } = createRendererPrimitives();
    // @ts-expect-error Deliberate invalid input verifies the unchanged runtime boundary.
    expect(() => el('section', [['ok', [undefined]]])).toThrow('undefined child is illegal');
    // @ts-expect-error Deliberate invalid input verifies the unchanged runtime boundary.
    expect(() => el('section', {}, [[false]])).toThrow('boolean child is illegal');
    // @ts-expect-error SVG factories must retain the same runtime boundary.
    expect(() => svg.root({ viewBox: '0 0 10 10' }, [[undefined]])).toThrow(
      'undefined child is illegal'
    );
    // @ts-expect-error SVG factories must retain the same runtime boundary.
    expect(() => svg.g({}, [[true]])).toThrow('boolean child is illegal');
  });

  it('retains explicit non-default normalization policies', () => {
    const shallow = createRendererPrimitives({ normalize: { flatten: 'shallow' } });
    const none = createRendererPrimitives({ normalize: { flatten: 'none' } });
    const keepNull = createRendererPrimitives({ normalize: { keepNull: true } });
    expect(() => shallow.el('section', [['nested']])).toThrow('nested array children');
    expect(() => none.el('section', ['array'])).toThrow('array children');
    expect(keepNull.el('section', [null, ['text', null]]).children).toEqual([null, 'text', null]);
  });
});
