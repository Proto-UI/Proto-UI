import { describe, expect, it } from 'vitest';
import type { DemoChild, DemoSpec } from './demo-types';
import { createDynamicChildrenModel, type DemoKeyedChild } from './demo-dynamic-children';

const slot = (ref: string, prototypeIds = ['example-item']) => ({
  kind: 'box' as const,
  ref,
  dynamicChildren: { prototypeIds },
  children: [],
});
const demo = (): DemoSpec => ({
  type: 'demo',
  root: {
    kind: 'box',
    ref: 'outer',
    children: [
      { kind: 'proto', prototypeId: 'example-root', ref: 'root' },
      slot('results'),
      slot('other'),
    ],
  },
});
const item = (key: string, ref = key): DemoKeyedChild => ({
  key,
  node: { kind: 'proto', prototypeId: 'example-item', ref, props: { value: key } },
});
const box = (key: string, ref = key): DemoKeyedChild => ({
  key,
  node: { kind: 'box', ref, children: ['Text'] },
});

describe('public dynamic-child admission and lifetime model (no renderer)', () => {
  it('includes declared future prototypes before an initially empty slot loads', () => {
    const model = createDynamicChildrenModel(demo());
    expect(model.prototypeIds).toEqual(['example-root', 'example-item']);
    expect(model.slotRefs).toEqual(['results', 'other']);
    expect(model.getCommitted('results')).toEqual([]);
    expect(
      model.begin('results', [{ key: 'optional', node: { kind: 'box', ref: undefined } }]).commit()
    ).toBe('committed');
  });

  it('copies and freezes initial declarations, incoming nested data and published entries', () => {
    const source = demo();
    const model = createDynamicChildrenModel(source);
    if (source.root.kind === 'box') source.root.children!.length = 0;
    const input = [
      {
        key: 'a',
        node: {
          kind: 'proto' as const,
          prototypeId: 'example-item',
          ref: 'a',
          props: { value: 'a', meta: { label: 'original' } },
          children: [{ kind: 'text' as const, text: 'Original' }],
        },
      },
    ];
    const tx = model.begin('results', input);
    input[0].node.props.meta.label = 'changed';
    input[0].node.children[0].text = 'Changed';
    input.length = 0;
    expect(tx.commit()).toBe('committed');
    const entry = model.getCommitted('results')[0];
    expect(entry.node).toMatchObject({
      props: { meta: { label: 'original' } },
      children: [{ text: 'Original' }],
    });
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.node)).toBe(true);
    if (typeof entry.node !== 'string' && entry.node.kind === 'proto') {
      expect(Object.isFrozen(entry.node.props!.meta)).toBe(true);
      expect(Object.isFrozen(entry.node.children)).toBe(true);
    }
    expect(() => {
      (entry as { identity: number }).identity = 999;
    }).toThrow();
    expect(model.slotRefs).toEqual(['results', 'other']);
  });

  it('retains same-key same-type identities through append/reorder and retires deletion/replacement', () => {
    const model = createDynamicChildrenModel(demo());
    const first = model.begin('results', [item('a'), item('b')]);
    first.commit();
    const second = model.begin('results', [item('b'), item('a'), item('c')]);
    expect(second.entries.map((entry) => entry.identity)).toEqual([
      first.entries[1].identity,
      first.entries[0].identity,
      expect.any(Number),
    ]);
    expect(second.retired).toEqual([]);
    second.commit();
    const third = model.begin('results', [box('b'), item('c')]);
    expect(third.entries[0].identity).not.toBe(first.entries[1].identity);
    expect(third.retired.map((entry) => entry.key)).toEqual(['b', 'a']);
    third.commit();
    const clear = model.begin('results', []);
    expect(clear.retired).toHaveLength(2);
    clear.commit();
    expect(model.getCommitted('results')).toEqual([]);
  });

  it('supersedes pending updates without publishing them and keeps commit idempotent', () => {
    const model = createDynamicChildrenModel(demo());
    const first = model.begin('results', [item('a')]);
    const second = model.begin('results', [item('b')]);
    expect(first.status()).toBe('superseded');
    expect(first.isCurrent()).toBe(false);
    expect(first.commit()).toBe('superseded');
    expect(model.getCommitted('results')).toEqual([]);
    expect(second.revision).toBe(first.revision + 1);
    expect(second.isCurrent()).toBe(true);
    expect(second.commit()).toBe('committed');
    expect(second.commit()).toBe('committed');
    expect(second.isCurrent()).toBe(false);
    expect(model.getCommitted('results')[0].key).toBe('b');
  });

  it('rejects collisions against static, committed and pending refs across slots', () => {
    const model = createDynamicChildrenModel(demo());
    expect(() => model.begin('results', [item('x', 'outer')])).toThrow(/static tree/);
    expect(() => model.begin('results', [item('x', 'results')])).toThrow(/static tree/);
    const pending = model.begin('results', [item('x', 'shared')]);
    expect(() => model.begin('other', [item('y', 'shared')])).toThrow(/collides with slot/);
    pending.commit();
    const removal = model.begin('results', []);
    expect(() => model.begin('other', [item('y', 'shared')])).toThrow(/collides with slot/);
    removal.commit();
    expect(model.begin('other', [item('y', 'shared')]).commit()).toBe('committed');
  });

  it('allows same-slot ref reuse but rejects duplicates across descendants/items', () => {
    const model = createDynamicChildrenModel(demo());
    model.begin('results', [item('a', 'shared')]).commit();
    expect(model.begin('results', [item('b', 'shared')]).commit()).toBe('committed');
    expect(() => model.begin('results', [item('a', 'duplicate'), box('b', 'duplicate')])).toThrow(
      /duplicate ref/
    );
    expect(() =>
      model.begin('results', [
        {
          key: 'a',
          node: {
            kind: 'box',
            ref: 'duplicate',
            children: [{ kind: 'box', ref: 'duplicate' }],
          },
        },
      ])
    ).toThrow(/duplicate ref/);
  });

  it('releases pending reservations on cancellation without removing the committed tree', () => {
    const model = createDynamicChildrenModel(demo());
    model.begin('results', [item('old')]).commit();
    const pending = model.begin('results', [item('new', 'reserved')]);
    pending.cancel();
    pending.cancel();
    expect(pending.commit()).toBe('superseded');
    expect(model.getCommitted('results')[0].key).toBe('old');
    expect(model.begin('other', [item('other', 'reserved')]).commit()).toBe('committed');
  });

  it('invalid updates do not cancel a valid pending update or mutate the committed tree', () => {
    const model = createDynamicChildrenModel(demo());
    model.begin('results', [item('old')]).commit();
    const good = model.begin('results', [item('new')]);
    expect(() => model.begin('results', [item('duplicate'), item('duplicate')])).toThrow(
      /duplicate key/
    );
    expect(good.isCurrent()).toBe(true);
    expect(model.getCommitted('results')[0].key).toBe('old');
    expect(good.commit()).toBe('committed');
  });

  it('validation snapshots without reserving refs or superseding pending transactions', () => {
    const model = createDynamicChildrenModel(demo());
    const pending = model.begin('results', [item('live')]);
    const input = [item('candidate')];
    const validated = model.validate('results', input);
    input.length = 0;
    expect(validated).toHaveLength(1);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(pending.isCurrent()).toBe(true);
    expect(() => model.validate('results', [item('x'), item('x')])).toThrow(/duplicate key/);
    expect(pending.isCurrent()).toBe(true);
    // Non-reserving validation is followed by admission again when commit starts.
    model.begin('other', [item('candidate')]).commit();
    expect(() => model.begin('results', validated)).toThrow(/collides with slot/);
    expect(pending.isCurrent()).toBe(true);
  });

  it('rejects undeclared slots/prototypes, nested declarations and malformed authored data', () => {
    const model = createDynamicChildrenModel(demo());
    expect(() => model.begin('missing', [])).toThrow(/undeclared slot/);
    expect(() =>
      model.begin('results', [
        {
          key: 'x',
          node: {
            kind: 'box',
            children: [{ kind: 'proto', prototypeId: 'not-declared' }],
          },
        },
      ])
    ).toThrow(/not declared/);
    expect(() => model.begin('results', [{ key: 'x', node: slot('nested') }])).toThrow(
      /nested dynamic/
    );
    expect(() => model.begin('results', [{ key: '', node: 'Text' }])).toThrow(/nonempty key/);
    expect(() =>
      model.begin('results', [
        {
          key: 'x',
          node: {
            kind: 'proto',
            prototypeId: 'example-item',
            props: { onExecute() {} },
          },
        },
      ])
    ).toThrow(/JSON-like/);
    const cyclic: { kind: 'box'; children: DemoChild[] } = { kind: 'box', children: [] };
    cyclic.children.push(cyclic);
    expect(() => model.begin('results', [{ key: 'x', node: cyclic }])).toThrow(/cyclic/);
    const accessor = Object.defineProperty({ key: 'x' }, 'node', {
      enumerable: true,
      get() {
        throw new Error('must not invoke user getter');
      },
    }) as DemoKeyedChild;
    expect(() => model.begin('results', [accessor])).toThrow(/accessor/);
  });

  it('rejects invalid initial declarations and duplicate static refs', () => {
    const initial = (root: unknown) => ({ type: 'demo', root }) as DemoSpec;
    expect(() => createDynamicChildrenModel(initial({ ...slot(''), ref: '' }))).toThrow();
    expect(() =>
      createDynamicChildrenModel(initial({ ...slot('r'), children: ['not empty'] }))
    ).toThrow(/requires nonempty ref and empty initial children/);
    expect(() => createDynamicChildrenModel(initial(slot('r', ['a', 'a'])))).toThrow(
      /duplicate declared/
    );
    expect(() =>
      createDynamicChildrenModel(initial({ kind: 'box', children: [slot('r'), slot('r')] }))
    ).toThrow(/duplicate ref/);
    expect(() =>
      createDynamicChildrenModel(
        initial({
          kind: 'proto',
          prototypeId: 'a',
          ref: 'r',
          dynamicChildren: { prototypeIds: [] },
        })
      )
    ).toThrow(/only a ref-bearing box/);
  });

  it('disposal invalidates pending commits, clears model resources, and prohibits later updates', () => {
    const model = createDynamicChildrenModel(demo());
    model.begin('results', [item('old')]).commit();
    const pending = model.begin('results', [item('new')]);
    model.dispose();
    model.dispose();
    expect(pending.status()).toBe('disposed');
    expect(pending.isCurrent()).toBe(false);
    expect(pending.commit()).toBe('disposed');
    expect(model.getCommitted('results')).toEqual([]);
    expect(() => model.begin('results', [])).toThrow(/disposed/);
  });
  // Append inside the existing model test describe; uses existing demo(), item().
  it('allows retained subtree value changes but rejects topology or ref changes before superseding', () => {
    const model = createDynamicChildrenModel(demo());
    const original = [
      {
        key: 'result',
        node: {
          kind: 'proto' as const,
          prototypeId: 'example-item',
          ref: 'row',
          props: { value: 'original' },
          children: [
            { kind: 'box' as const, tag: 'span' as const, ref: 'title', children: ['Title'] },
            { kind: 'text' as const, text: 'Description' },
          ],
        },
      },
    ];
    model.begin('results', original).commit();
    const updated = [
      {
        key: 'result',
        node: {
          ...original[0].node,
          className: 'changed',
          props: { value: 'updated' },
          children: [
            {
              kind: 'box' as const,
              tag: 'span' as const,
              ref: 'title',
              attrs: { title: 'new' },
              children: ['New title'],
            },
            { kind: 'text' as const, text: '' },
          ],
        },
      },
    ];
    const good = model.begin('results', updated);
    expect(good.entries[0].identity).toBe(model.getCommitted('results')[0].identity);
    for (const node of [
      { ...updated[0].node, ref: 'other-row' },
      { ...updated[0].node, children: [] },
      { ...updated[0].node, children: [...updated[0].node.children, 'Extra'] },
      {
        ...updated[0].node,
        children: [
          { kind: 'box' as const, tag: 'div' as const, ref: 'title', children: ['Title'] },
          { kind: 'text' as const, text: '' },
        ],
      },
      {
        ...updated[0].node,
        children: [
          { kind: 'box' as const, tag: 'span' as const, ref: 'renamed', children: ['Title'] },
          { kind: 'text' as const, text: '' },
        ],
      },
      {
        ...updated[0].node,
        children: [
          { kind: 'box' as const, tag: 'span' as const, ref: 'title', children: ['Title'] },
          '', // string vs explicit text-node kind is a shape change in this v1.
        ],
      },
    ]) {
      expect(() => model.validate('results', [{ key: 'result', node }])).toThrow(/subtree shape/);
      expect(() => model.begin('results', [{ key: 'result', node }])).toThrow(/subtree shape/);
      expect(good.isCurrent()).toBe(true);
    }
    good.commit();
    // A new key can replace the full admitted subtree; same-slot refs may be reused.
    const replacement = model.begin('results', [
      {
        key: 'new-result',
        node: {
          kind: 'proto',
          prototypeId: 'example-item',
          ref: 'row',
          children: ['Simpler'],
        },
      },
    ]);
    expect(replacement.retired).toHaveLength(1);
    replacement.commit();
    // Same direct key changing root kind remains an explicit identity replacement.
    const differentKind = model.begin('results', [
      {
        key: 'new-result',
        node: {
          kind: 'box',
          ref: 'row',
          children: ['Box'],
        },
      },
    ]);
    expect(differentKind.retired).toHaveLength(1);
    expect(differentKind.entries[0].identity).not.toBe(replacement.entries[0].identity);
  });
});
