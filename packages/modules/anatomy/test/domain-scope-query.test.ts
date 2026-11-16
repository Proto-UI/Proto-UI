import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnatomyFamily } from '@proto.ui/core';
import { ANATOMY_PARENT_CAP } from '../src/caps';
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

  it('uses one logical parent capability for an ordered parts read', () => {
    const family = createAnatomyFamily('order-query-ancestry', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: '*' } },
      },
    });
    const parents = new Map<object, object | null>();
    const getParent = (token: unknown) => parents.get(token as object) ?? null;
    const create = (name: string, parent: object | null, role: string) => {
      const token = { name };
      parents.set(token, parent);
      const caps = makeCaps({
        instance: token,
        getParent,
        getPrototype: () => ({ name, setup() {} }),
      });
      const getCap = vi.spyOn(caps, 'get');
      const impl = new AnatomyModuleImpl(caps, name, {
        get: () => undefined,
        getAll: () => ({}),
        has: () => false,
        keys: () => [],
      } as any);
      live.push(impl);
      impl.claim(family, { role });
      return { token, impl, getCap };
    };
    const outer = create('outer', null, 'root');
    const nested = create('nested', outer.token, 'root');
    const wrapper = {};
    parents.set(wrapper, nested.token);
    const first = create('first', wrapper, 'item');
    create('second', wrapper, 'item');
    const foreign = create('foreign', null, 'root');
    create('foreign-item', foreign.token, 'item');

    nested.getCap.mockClear();
    expect(nested.impl.tryOrderedPartsOf(family, 'item')).toHaveLength(2);
    expect(nested.getCap.mock.calls.filter(([cap]) => cap === ANATOMY_PARENT_CAP)).toHaveLength(1);

    parents.set(wrapper, outer.token);
    expect(nested.impl.tryOrderedPartsOf(family, 'item')).toHaveLength(0);
    expect(outer.impl.tryOrderedPartsOf(family, 'item')).toHaveLength(2);

    parents.set(wrapper, nested.token);
    nested.impl.dispose();
    expect(outer.impl.tryOrderedPartsOf(family, 'item')).toHaveLength(0);
    expect(first.impl.tryOrderedPartsOf(family, 'item')).toBeNull();

    parents.set(wrapper, outer.token);
    expect(first.impl.tryOrderedPartsOf(family, 'item')).toHaveLength(2);
    expect(foreign.impl.tryOrderedPartsOf(family, 'item')).toHaveLength(1);
  });
});

describe('Anatomy claim inventory', () => {
  it('preserves instance order across late claims and terminal retirement', () => {
    const roles = {
      root: { cardinality: { min: 1, max: 1 } },
      item: { cardinality: { min: 0, max: '*' as const } },
    };
    const family = createAnatomyFamily('ordered-claim-inventory', { roles });
    const other = createAnatomyFamily('other-claim-inventory', { roles });
    const parents = new Map<object, object | null>();
    const getParent = (token: unknown) => parents.get(token as object) ?? null;
    const create = (name: string, parent: object | null) => {
      const token = { name };
      parents.set(token, parent);
      const impl = new AnatomyModuleImpl(
        makeCaps({
          instance: token,
          getParent,
          getPrototype: () => ({ name: 'part', setup() {} }),
        }),
        'part',
        { get: () => undefined, getAll: () => ({}), has: () => false, keys: () => [] } as any
      );
      live.push(impl);
      return { token, impl };
    };
    const root = create('root', null);
    root.impl.claim(family, { role: 'root' });
    root.impl.claim(other, { role: 'root' });
    const first = create('first', root.token);
    first.impl.claim(other, { role: 'item' });
    const second = create('second', root.token);
    second.impl.claim(family, { role: 'item' });

    const ordered = (current: typeof family) =>
      root.impl.tryOrderedPartsOf(current, 'item')?.map(root.impl.port.resolvePartInstance);
    expect(ordered(family)).toEqual([second.token]);
    expect(ordered(other)).toEqual([first.token]);

    first.impl.claim(family, { role: 'item' });
    expect(ordered(family)).toEqual([first.token, second.token]);
    expect(ordered(other)).toEqual([first.token]);

    first.impl.dispose();
    expect(ordered(family)).toEqual([second.token]);
    expect(ordered(other)).toEqual([]);
  });
});

describe('Anatomy order observer attachment', () => {
  it('observes the current logical root without reading foreign memberships', () => {
    const family = createAnatomyFamily('order-observer-locality', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: '*' } },
      },
    });
    const root = {};
    const item = {};
    const foreignRoot = {};
    const foreignItem = {};
    const target = document.createElement('div');
    const parents = new Map([
      [item, root],
      [foreignItem, foreignRoot],
    ]);
    const getParent = vi.fn((instance: unknown) => parents.get(instance as object) ?? null);
    const stop = vi.fn();
    const observe = vi.fn(() => stop);
    const create = (instance: object, role: string) => {
      const impl = new AnatomyModuleImpl(
        makeCaps({
          instance,
          getParent,
          getPrototype: () => ({ name: 'part', setup() {} }),
          getRootTarget: (token) => (token === root ? target : null),
          orderObserver: observe,
        }),
        'part',
        { get: () => undefined, getAll: () => ({}), has: () => false, keys: () => [] } as any
      );
      live.push(impl);
      impl.claim(family, { role });
      return impl;
    };
    create(root, 'root');
    create(foreignRoot, 'root');
    create(foreignItem, 'item');
    const current = create(item, 'item');
    const notify = vi.fn();
    current.port.subscribeOrder(family, notify);

    getParent.mockClear();
    current.onMountPhase('mounted', 1);
    expect(observe).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith(target, expect.any(Function));
    expect(getParent).toHaveBeenCalledTimes(1);
    expect(getParent.mock.calls[0]?.[0]).toBe(item);
    expect(notify).not.toHaveBeenCalled();

    current.onMountPhase('detached', 1);
    expect(stop).toHaveBeenCalledOnce();
  });
});
