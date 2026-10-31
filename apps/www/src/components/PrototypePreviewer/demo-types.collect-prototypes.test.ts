import { describe, expect, it } from 'vitest';
import { collectPrototypeIds, type DemoNode } from './demo-types';
import { assertProjectionRecipeClosure } from './projection-composition';

describe('authored Prototype dependency collection', () => {
  it('includes empty and nested dynamic slots, deduplicates, and retains static traversal', () => {
    const node: DemoNode = {
      kind: 'proto',
      prototypeId: 'static-root',
      children: [
        {
          kind: 'box',
          ref: 'empty-slot',
          dynamicChildren: { prototypeIds: ['future-item', 'future-empty', 'static-root'] },
          children: [],
        },
        {
          kind: 'box',
          children: [
            { kind: 'proto', prototypeId: 'static-child', children: ['Text'] },
            {
              kind: 'box',
              ref: 'nested-slot',
              dynamicChildren: { prototypeIds: ['future-action', 'future-item'] },
            },
          ],
        },
      ],
    };
    const before = JSON.stringify(node);
    const ids = new Set<string>(['retained']);
    collectPrototypeIds(node, ids);
    expect([...ids]).toEqual([
      'retained',
      'static-root',
      'future-item',
      'future-empty',
      'static-child',
      'future-action',
    ]);
    expect(JSON.stringify(node)).toBe(before);
  });

  it('does not infer dependencies from props, text or unrelated attributes', () => {
    const node: DemoNode = {
      kind: 'proto',
      prototypeId: 'actual-root',
      props: { prototypeId: 'not-a-dependency', description: 'future-item' },
      children: [
        'text-prototype-id',
        { kind: 'text', text: 'also-not-a-dependency' },
        { kind: 'box', attrs: { 'data-prototype-id': 'unrelated' }, children: [] },
      ],
    };
    const ids = new Set<string>();
    collectPrototypeIds(node, ids);
    expect([...ids]).toEqual(['actual-root']);
  });

  it('leaves string and text-only input empty', () => {
    const ids = new Set<string>();
    collectPrototypeIds('plain text', ids);
    collectPrototypeIds({ kind: 'text', text: 'plain text node' }, ids);
    expect([...ids]).toEqual([]);
  });

  it('keeps exact closure rejection for omitted dynamic and unused declared identities', () => {
    const node: DemoNode = {
      kind: 'box',
      children: [
        {
          kind: 'box',
          ref: 'future',
          dynamicChildren: { prototypeIds: ['future-only'] },
          children: [],
        },
        { kind: 'proto', prototypeId: 'static-only' },
      ],
    };
    const ids = new Set<string>();
    collectPrototypeIds(node, ids);
    expect([...ids]).toEqual(['future-only', 'static-only']);
    expect(() => assertProjectionRecipeClosure(node, [...ids], 'generic')).not.toThrow();
    expect(() => assertProjectionRecipeClosure(node, ['static-only'], 'generic')).toThrow(
      'uses undeclared Prototype(s): future-only'
    );
    expect(() =>
      assertProjectionRecipeClosure(node, [...ids, 'never-authored'], 'generic')
    ).toThrow('missing required Prototype(s): never-authored');
  });
});
