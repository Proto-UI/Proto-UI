import { describe, expect, it } from 'vitest';
import { createAnatomyFamily, type AnatomyFamily, type AnatomyPartView } from '@proto.ui/core';
import { AnatomyModuleImpl } from '../src/impl';
import { createSysCaps, makeCaps } from './utils/fake-caps';

function requiredParts(impl: AnatomyModuleImpl, family: AnatomyFamily, role: string) {
  const parts = impl.partsOf(family, role);
  if (parts === null) throw new Error(`Expected connected ${role} collection`);
  return parts;
}

function fixture() {
  const family = createAnatomyFamily('scoped-query', {
    roles: Object.fromEntries(
      ['root', 'item', 'text'].map((role) => [
        role,
        {
          cardinality: { min: role === 'root' ? 1 : 0, max: role === 'root' ? 1 : '*' },
        },
      ])
    ),
  });
  const parents = new Map<object, object | null>();
  const all: AnatomyModuleImpl[] = [];
  function add(role: string, parent: object | null = null) {
    const token = {};
    parents.set(token, parent);
    const sys = createSysCaps();
    const impl = new AnatomyModuleImpl(
      makeCaps({
        sys,
        instance: token,
        getParent: (i) => parents.get(i as object) ?? null,
        getPrototype: () => ({ name: role, setup() {} }),
        getRootTarget: () => ({ privateHost: true }),
      }),
      role,
      { get: () => null, getAll: () => ({}), has: () => false, keys: () => [] } as any
    );
    impl.claim(family, { role });
    sys.__setExecPhase('callback');
    all.push(impl);
    return { token, impl, sys };
  }
  return { family, parents, add, dispose: () => all.reverse().forEach((i) => i.dispose()) };
}

describe('author-safe scoped logical descendant query', () => {
  it('returns strict same-domain descendants and safe identities without requiring targets', () => {
    const f = fixture();
    try {
      const root = f.add('root');
      const row = f.add('item', root.token);
      f.add('text', row.token);
      const other = f.add('item', root.token);
      f.add('text', other.token);
      const ancestor = requiredParts(row.impl, f.family, 'item')[0]!;
      const found = root.impl.descendantsOf(f.family, ancestor, 'text');
      expect(found).toHaveLength(1);
      expect(Object.keys(found[0]!).sort()).toEqual(['getExpose', 'hasExpose', 'hasHook', 'role']);
      expect(root.impl.descendantsOf(f.family, ancestor, 'item')).toEqual([]);
      expect(root.impl.port.resolvePartInstance(found[0]!)).toBe(
        root.impl.port.resolvePartInstance(
          root.impl.port.descendantsOf(f.family, ancestor, 'text')[0]!
        )
      );
    } finally {
      f.dispose();
    }
  });

  it('excludes nested same-family domains and forged or foreign ancestors', () => {
    const f = fixture();
    try {
      const root = f.add('root');
      const row = f.add('item', root.token);
      f.add('text', row.token);
      const nested = f.add('root', row.token);
      const nestedRow = f.add('item', nested.token);
      f.add('text', nestedRow.token);
      const ancestor = requiredParts(root.impl, f.family, 'item')[0]!;
      const nestedAncestor = requiredParts(nested.impl, f.family, 'item')[0]!;
      expect(root.impl.descendantsOf(f.family, ancestor, 'text')).toHaveLength(1);
      expect(root.impl.descendantsOf(f.family, nestedAncestor, 'text')).toEqual([]);
      expect(nested.impl.descendantsOf(f.family, ancestor, 'text')).toEqual([]);
      expect(root.impl.descendantsOf(f.family, {} as AnatomyPartView, 'text')).toEqual([]);
      const otherFamily = createAnatomyFamily('other', {
        roles: { root: { cardinality: { min: 1, max: 1 } } },
      });
      expect(root.impl.descendantsOf(otherFamily, ancestor, 'text')).toEqual([]);
    } finally {
      f.dispose();
    }
  });

  it('reads current ancestry after reparenting and rejects retired retained views', () => {
    const f = fixture();
    try {
      const root = f.add('root');
      const row = f.add('item', root.token);
      const text = f.add('text', row.token);
      const other = f.add('item', root.token);
      const [ancestor, otherAncestor] = requiredParts(root.impl, f.family, 'item');
      expect(root.impl.descendantsOf(f.family, ancestor!, 'text')).toHaveLength(1);
      f.parents.set(text.token, other.token);
      text.impl.port.syncStructure();
      expect(root.impl.descendantsOf(f.family, ancestor!, 'text')).toEqual([]);
      expect(root.impl.descendantsOf(f.family, otherAncestor!, 'text')).toHaveLength(1);
      other.impl.dispose();
      expect(root.impl.descendantsOf(f.family, otherAncestor!, 'text')).toEqual([]);
    } finally {
      f.dispose();
    }
  });

  it('uses ordinary runtime-only phase guard', () => {
    const f = fixture();
    try {
      const root = f.add('root');
      const ancestor = requiredParts(root.impl, f.family, 'root')[0]!;
      root.sys.__setExecPhase('setup');
      expect(() => root.impl.descendantsOf(f.family, ancestor, 'text')).toThrow(/runtime-only/);
      root.sys.__setExecPhase('render');
      expect(root.impl.descendantsOf(f.family, ancestor, 'text')).toEqual([]);
    } finally {
      f.dispose();
    }
  });
});
