import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnatomyFamily } from '@proto.ui/core';
import { AnatomyModuleImpl } from '../src/impl';
import { makeCaps } from './utils/fake-caps';

const live: AnatomyModuleImpl[] = [];
afterEach(() => {
  for (const impl of live.splice(0).reverse()) impl.dispose();
});

describe('Anatomy scope-only queries', () => {
  it('walks only the queried ancestry while resolving current nearest roots', () => {
    const family = createAnatomyFamily('scope-query-locality', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: '*' } },
      },
    });
    const parents = new Map<unknown, unknown>();
    const getParent = vi.fn((token: unknown) => parents.get(token) ?? null);
    const create = (name: string, parent: unknown, role: string) => {
      const token = { name };
      parents.set(token, parent);
      const impl = new AnatomyModuleImpl(
        makeCaps({ instance: token, getParent, getPrototype: () => ({ name, setup() {} }) }),
        name,
        { get: () => undefined, getAll: () => ({}), has: () => false, keys: () => [] } as any
      );
      live.push(impl);
      impl.claim(family, { role });
      return { token, impl };
    };
    const outer = create('outer', null, 'root');
    const nested = create('nested', outer.token, 'root');
    const current = create('current', nested.token, 'item');
    const foreign = create('foreign', null, 'root');
    for (let index = 0; index < 12; index++) create(`foreign-${index}`, foreign.token, 'item');

    getParent.mockClear();
    expect(current.impl.port.resolveDomainScope(family)).toBe(nested.token);
    // C-ANATOMY-0005-B/C: scope depends on this ancestry, not a parts inventory.
    // Count host reads rather than using a machine-dependent timing budget.
    expect(getParent.mock.calls.map(([token]) => token)).toEqual([current.token]);

    parents.set(current.token, outer.token);
    getParent.mockClear();
    expect(current.impl.port.resolveDomainScope(family)).toBe(outer.token);
    expect(getParent.mock.calls.map(([token]) => token)).toEqual([current.token]);

    parents.set(current.token, null);
    getParent.mockClear();
    expect(current.impl.port.resolveDomainScope(family)).toBeNull();
    expect(getParent.mock.calls.map(([token]) => token)).toEqual([current.token]);
  });
});
