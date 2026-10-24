import { describe, expect, it } from 'vitest';
import { createRendererPrimitives } from '../src/spec/template';
import type { TemplateNode } from '../src/spec/template';
import type { OwnedDecorationTarget } from '../src/spec/feedback/style';
import {
  equalOwnedTemplateBlueprint,
  snapshotOwnedTemplateBlueprint,
} from '../src/spec/owned-template-blueprint';

const r = createRendererPrimitives();
const target = {} as OwnedDecorationTarget;
const otherTarget = {} as OwnedDecorationTarget;
const snapshot = snapshotOwnedTemplateBlueprint;
const same = (a: unknown, b: unknown) => equalOwnedTemplateBlueprint(snapshot(a), snapshot(b));
const leaf = (identity = target) => r.decoration(identity);
const template = () =>
  r.el('div', { style: { kind: 'tw', tokens: ['p-2', 'p-4'] } }, [
    'label',
    1,
    r.svg.root({ viewBox: '0 0 24 24' }, r.svg.path({ d: 'M0 0' })),
    r.slot(),
    leaf(),
    leaf(otherTarget),
  ]);

function counted(fields: Record<string, unknown>, counts: Record<string, number>, prefix: string) {
  const value = {};
  for (const key of Object.keys(fields)) {
    Object.defineProperty(value, key, {
      enumerable: true,
      get() {
        const id = `${prefix}.${key}`;
        counts[id] = (counts[id] ?? 0) + 1;
        return fields[key];
      },
    });
  }
  return value;
}

describe('owned fixed Template blueprint', () => {
  it('accepts fresh equivalent objects and ignores own-key insertion order', () => {
    expect(same(template(), template())).toBe(true);
    expect(same({ type: 'div', children: 'x' }, { children: 'x', type: 'div' })).toBe(true);
    expect(
      same(
        r.svg.root({ viewBox: '0 0 24 24', fill: 'none' }),
        r.svg.root({ fill: 'none', viewBox: '0 0 24 24' })
      )
    ).toBe(true);
    expect(same({ type: 'div' }, r.el('div'))).toBe(true);
    expect(same({ type: { kind: 'slot' } }, r.slot())).toBe(true);
    expect(same(undefined, null)).toBe(true);
  });

  it.each([
    ['wrapper', () => ({ ...template(), type: 'span' })],
    ['text', () => ({ ...template(), children: ['different', leaf()] })],
    ['text type', () => r.el('div', [1, leaf()])],
    ['token order', () => ({ ...template(), style: { kind: 'tw', tokens: ['p-4', 'p-2'] } })],
    ['token value', () => ({ ...template(), style: { kind: 'tw', tokens: ['p-2', 'p-8'] } })],
    ['empty versus absent style', () => ({ ...template(), style: { kind: 'tw', tokens: [] } })],
    [
      'SVG prop',
      () => ({ ...template(), children: [r.svg.root({ viewBox: '0 0 20 20' }), leaf()] }),
    ],
    ['slot placement', () => r.el('div', [leaf(), r.slot()])],
    ['target identity', () => r.el('div', [leaf({} as OwnedDecorationTarget)])],
    ['target order', () => r.el('div', [leaf(otherTarget), leaf()])],
  ])('detects changed %s', (_label, change) => {
    expect(same(template(), change())).toBe(false);
  });

  it('compares each static semantic independently', () => {
    expect(same('1', 1)).toBe(false);
    expect(same(0, -0)).toBe(false);
    expect(same({ type: 'div' }, { type: 'span' })).toBe(false);
    expect(same({ type: 'div' }, { type: 'div', style: { kind: 'tw', tokens: [] } })).toBe(false);
    expect(same(r.el('div', [r.slot(), leaf()]), r.el('div', [leaf(), r.slot()]))).toBe(false);
    expect(same([leaf(), leaf(otherTarget)], [leaf(otherTarget), leaf()])).toBe(false);
    expect(same(leaf(), leaf({} as OwnedDecorationTarget))).toBe(false);
    expect(same(r.svg.polygon({ points: '0,0 1,1' }), r.svg.polyline({ points: '0,0 1,1' }))).toBe(
      false
    );
    expect(
      same(r.svg.path({ d: 'M0 0', strokeWidth: 2 }), r.svg.path({ d: 'M0 0', strokeWidth: '2' }))
    ).toBe(false);
    expect(same(r.svg.path({ d: 'M0 0' }), r.svg.path({ d: 'M1 1' }))).toBe(false);
    expect(
      same(r.svg.g({}, r.svg.path({ d: 'M0 0' })), r.svg.g({}, r.svg.path({ d: 'M1 1' })))
    ).toBe(false);
  });

  it('reads source accessors once, memoizes repeated nodes, and captures dense array getters once', () => {
    const counts: Record<string, number> = {};
    const tokens: string[] = [];
    Object.defineProperty(tokens, '0', {
      enumerable: true,
      get() {
        counts.token = (counts.token ?? 0) + 1;
        return 'p-2';
      },
    });
    const handle = counted({ kind: 'tw', tokens }, counts, 'style');
    const type = counted({ kind: 'decoration', target }, counts, 'type');
    const decoration = counted({ type }, counts, 'leaf');
    const pathProps = counted({ d: 'M0 0', strokeWidth: 2 }, counts, 'props');
    const glyph = counted(
      { kind: 'svg-node', tag: 'path', props: pathProps, children: null },
      counts,
      'svg'
    );
    const node = counted(
      { type: 'div', style: handle, children: [glyph, decoration] },
      counts,
      'node'
    );
    const roots = [node, node];
    const result = snapshot(roots) as TemplateNode[];
    expect(result[0]).toBe(result[1]);
    expect(Object.values(counts)).toEqual(Array(Object.keys(counts).length).fill(1));
    expect(counts).toMatchObject({
      'node.type': 1,
      'node.children': 1,
      'style.tokens': 1,
      token: 1,
      'type.target': 1,
      'props.d': 1,
      'svg.kind': 1,
    });
    equalOwnedTemplateBlueprint(
      result,
      snapshot([
        r.el('div', { style: { kind: 'tw', tokens: ['p-2'] } }, [
          r.svg.path({ d: 'M0 0', strokeWidth: 2 }),
          leaf(),
        ]),
        r.el('div'),
      ])
    );
    expect(Object.values(counts).every((count) => count === 1)).toBe(true);
  });

  it('reuses source reads across valid array roles and SVG prop roles', () => {
    let reads = 0;
    const values: string[] = [];
    Object.defineProperty(values, 0, {
      enumerable: true,
      get() {
        reads++;
        return 'text';
      },
    });
    snapshot({ type: 'div', style: { kind: 'tw', tokens: values }, children: values });
    expect(reads).toBe(1);
    const propsCounts: Record<string, number> = {};
    const props = counted({ points: '0,0 1,1' }, propsCounts, 'props');
    snapshot([
      { kind: 'svg-node', tag: 'polygon', props },
      { kind: 'svg-node', tag: 'polyline', props },
    ]);
    expect(propsCounts['props.points']).toBe(1);
  });

  it('validates aliases in each context rather than accepting an incompatible memo hit', () => {
    const values = [r.el('div')];
    expect(() =>
      snapshot({
        type: 'div',
        children: [
          { type: 'div', children: values },
          { type: 'div', style: { kind: 'tw', tokens: values } },
        ],
      })
    ).toThrow(/token/);
    const props = { points: '0,0 1,1' };
    expect(() =>
      snapshot([
        { kind: 'svg-node', tag: 'polygon', props },
        { kind: 'svg-node', tag: 'path', props },
      ])
    ).toThrow();
  });

  it('owns and deeply freezes copies without freezing or inspecting opaque targets', () => {
    const opaque = new Proxy(
      {},
      {
        get() {
          throw new Error('target get');
        },
        ownKeys() {
          throw new Error('target ownKeys');
        },
        getPrototypeOf() {
          throw new Error('target prototype');
        },
        preventExtensions() {
          throw new Error('target freeze');
        },
      }
    ) as OwnedDecorationTarget;
    const tokens = ['p-2', 'p-4'];
    const props = { d: 'M0 0' };
    const source = {
      type: 'div',
      style: { kind: 'tw', tokens },
      children: [{ kind: 'svg-node', tag: 'path', props }, leaf(opaque)],
    };
    const result = snapshot(source) as TemplateNode;
    const before = snapshot(source);
    tokens.reverse();
    props.d = 'M1 1';
    source.type = 'span';
    source.children.reverse();
    expect(equalOwnedTemplateBlueprint(result, before)).toBe(true);
    expect(equalOwnedTemplateBlueprint(result, snapshot(source))).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.style)).toBe(true);
    expect(Object.isFrozen(result.style!.tokens)).toBe(true);
    expect(Object.isFrozen(result.children)).toBe(true);
    const children = result.children as TemplateNode[];
    expect(Object.isFrozen(children[0])).toBe(true);
    expect(Object.isFrozen((children[0] as any).props)).toBe(true);
    expect(Object.isFrozen(children[1].type)).toBe(true);
    expect((children[1].type as any).target).toBe(opaque);
    expect(Object.isFrozen(source)).toBe(false);
    expect(() => {
      (result.style!.tokens as string[]).push('p-8');
    }).toThrow();
    expect(same(leaf(opaque), leaf(opaque))).toBe(true);
    expect(same(leaf(opaque), leaf(otherTarget))).toBe(false);
  });

  it('rejects cycles, including a previously aliased source now reached through its own child', () => {
    const node: any = { type: 'div' };
    node.children = node;
    expect(() => snapshot(node)).toThrow(/cycle/);
    const array: any[] = [];
    const parent: any = { type: 'div', children: array };
    array.push(parent);
    expect(() => snapshot(array)).toThrow(/cycle/);
    const a: any = { type: 'div' };
    const b: any = { type: 'div', children: a };
    a.children = b;
    expect(() => snapshot([a, a])).toThrow(/cycle/);
  });

  it('rejects multiple slot occurrences even when the slot source is shared', () => {
    const slot = r.slot();
    expect(() => snapshot([slot, slot])).toThrow(/multiple slots/);
    expect(() => snapshot([r.el('div', slot), r.el('span', slot)])).toThrow(/multiple slots/);
  });

  it.each([undefined, true, false, NaN, Infinity, -Infinity, 1n, () => null, Symbol('value')])(
    'rejects invalid array child %s',
    (value) => {
      expect(() => snapshot([value])).toThrow();
    }
  );

  it('rejects array holes, own extra keys and custom iteration without invoking it', () => {
    const sparse = new Array(1);
    expect(() => snapshot(sparse)).toThrow(/hole/);
    const extra: any = ['x'];
    Object.defineProperty(extra, 'extra', { value: true });
    expect(() => snapshot(extra)).toThrow();
    const symbol: any = ['x'];
    symbol[Symbol('extra')] = 1;
    expect(() => snapshot(symbol)).toThrow();
    let iterated = false;
    const custom: any = ['x'];
    custom[Symbol.iterator] = function* () {
      iterated = true;
      yield 'x';
    };
    expect(() => snapshot(custom)).toThrow();
    expect(iterated).toBe(false);
    const inheritedIterator = Object.create(Array.prototype);
    inheritedIterator[Symbol.iterator] = () => {
      throw new Error('iteration');
    };
    const inherited = ['x'];
    Object.setPrototypeOf(inherited, inheritedIterator);
    expect(snapshot(inherited)).toEqual(['x']);
  });

  it.each([
    { type: 'div', extra: 'x' },
    { type: 'div', [Symbol('extra')]: 'x' },
    { type: { kind: 'slot', name: 'named' } },
    { type: { kind: 'slot' }, style: { kind: 'tw', tokens: [] } },
    { type: { kind: 'slot' }, children: 'fallback' },
    { type: { kind: 'decoration', target }, children: null },
    { type: { kind: 'decoration', target, extra: true } },
    { type: { kind: 'decoration', target: null } },
    { type: 'div', style: { kind: 'css', tokens: [] } },
    { type: 'div', style: { kind: 'tw', tokens: [], [Symbol('x')]: 1 } },
    { type: 'div', style: { kind: 'tw', tokens: [undefined] } },
    { type: 'div', style: { kind: 'tw', tokens: [1] } },
    { kind: 'svg-node', tag: 'path', props: { d: 'M0 0' }, extra: true },
    { kind: 'svg-node', tag: 'path', props: { d: 'M0 0', [Symbol('x')]: 1 } },
    { kind: 'svg-node', tag: 'foreignObject', props: {} },
    { kind: 'svg-node', tag: 'path', props: { d: 'M0 0', onClick() {} } },
    { kind: 'svg-node', tag: 'path', props: { d: 'M0 0', 'aria-hidden': 'true' } },
    { kind: 'svg-node', tag: 'path', props: { d: 'M0 0', fill: undefined } },
    { kind: 'svg-node', tag: 'path', props: { d: 'M0 0', opacity: Infinity } },
    { kind: 'svg-node', tag: 'path', props: { d: 12 } },
    { kind: 'svg-node', tag: 'ellipse', props: { cx: '1', cy: 1, rx: 1, ry: 1 } },
    { kind: 'svg-node', tag: 'svg', props: {} },
    { kind: 'svg-node', tag: 'path', props: { d: '' } },
    { kind: 'svg-node', tag: 'path', props: { d: 'M0 0' }, children: 'invalid' },
    { kind: 'svg-node', tag: 'circle', props: { cx: 0, cy: 0 } },
  ])('rejects unsupported owned blueprint %j', (value) => {
    expect(() => snapshot(value)).toThrow();
  });

  it('rejects non-enumerable unknown fields without executing their getters or coercion', () => {
    let calls = 0;
    const value = { type: 'div' };
    Object.defineProperty(value, 'toJSON', {
      get() {
        calls++;
        throw new Error('toJSON');
      },
    });
    expect(() => snapshot(value)).toThrow(/unsupported own field/);
    expect(calls).toBe(0);
    const scalar = {
      toString() {
        calls++;
        return 'red';
      },
      valueOf() {
        calls++;
        return 1;
      },
    };
    expect(() =>
      snapshot({ kind: 'svg-node', tag: 'path', props: { d: 'M0 0', fill: scalar } })
    ).toThrow(/scalar/);
    expect(calls).toBe(0);
  });

  it('does not acquire required fields from an inherited accessor', () => {
    let calls = 0;
    const source = Object.create({
      get type() {
        calls++;
        return 'div';
      },
    });
    expect(() => snapshot(source)).toThrow();
    expect(calls).toBe(0);
  });

  it('retains the existing PrototypeRef rejection signature', () => {
    expect(() => snapshot({ type: { kind: 'prototype', name: 'X' } })).toThrow(
      '[Template] PrototypeRef is not allowed in Template v0.'
    );
  });

  it('accepts every supported SVG tag and permitted scalar field', () => {
    const shared = {
      fill: 'none',
      stroke: 'red',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      fillRule: 'nonzero',
      clipRule: 'evenodd',
      opacity: 0.5,
    };
    const nodes = [
      r.svg.root({
        viewBox: '0 0 24 24',
        width: 24,
        height: '24',
        'aria-hidden': 'true',
        ...shared,
      }),
      r.svg.g(shared),
      r.svg.path({ d: 'M0 0', ...shared }),
      r.svg.circle({ cx: 0, cy: '1', r: 2, ...shared }),
      r.svg.rect({ x: 0, y: '1', width: 2, height: '3', rx: 4, ry: 5, ...shared }),
      r.svg.line({ x1: 0, y1: 1, x2: '2', y2: '3', ...shared }),
      r.svg.polyline({ points: '0,0 1,1', ...shared }),
      r.svg.ellipse({ cx: 0, cy: 1, rx: 2, ry: 3, ...shared }),
      r.svg.polygon({ points: '0,0 1,1', ...shared }),
    ];
    const result = snapshot(nodes);
    expect(equalOwnedTemplateBlueprint(result, snapshot(nodes))).toBe(true);
    expect(result).toEqual(nodes);
  });
});
