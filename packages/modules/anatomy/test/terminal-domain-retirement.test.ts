import { afterEach, describe, expect, it } from 'vitest';
import { createAnatomyFamily, type AnatomyFamily } from '@proto.ui/core';
import { AnatomyModuleImpl } from '../src/impl';
import { makeCaps } from './utils/fake-caps';
import { ANATOMY_PARENT_CAP } from '../src/caps';

const live: AnatomyModuleImpl[] = [];
afterEach(() => {
  for (const impl of live.splice(0).reverse()) impl.dispose();
});
const family = (name: string) =>
  createAnatomyFamily(name, {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      item: { cardinality: { min: 0, max: '*' } },
      trigger: { cardinality: { min: 0, max: '*' } },
    },
  });
function fixture() {
  const parents = new Map<unknown, unknown>();
  const node = (name: string, parent: unknown, claims: Array<[AnatomyFamily, string]>) => {
    const token = { name };
    parents.set(token, parent);
    const caps = makeCaps({
      instance: token,
      getParent: (token) => parents.get(token) ?? null,
      getPrototype: () => ({ name, setup() {} }),
    });
    const impl = new AnatomyModuleImpl(caps, name, {
      has: (key: string) => key === 'name',
      get: () => name,
      getAll: () => ({ name }),
      keys: () => ['name'],
    } as any);
    live.push(impl);
    for (const [family, role] of claims) impl.claim(family, { role });
    return { token, impl, caps };
  };
  return { node, parents };
}
const names = (impl: AnatomyModuleImpl, family: AnatomyFamily) =>
  (impl.port.parts(family, { missing: 'empty' }) ?? []).map((part) => part.getExpose('name'));

describe('terminal Anatomy domains do not adopt their retiring descendants', () => {
  it('keeps nested root descendants out of the outer domain between parent and child disposal', () => {
    const a = family('terminal-nested');
    const { node } = fixture();
    const outer = node('outer', null, [[a, 'root']]);
    node('outer-item', outer.token, [[a, 'item']]);
    const nested = node('nested', outer.token, [[a, 'root']]);
    const child = node('nested-item', nested.token, [[a, 'item']]);
    const seen: unknown[][] = [];
    outer.impl.port.subscribeOrder(a, () => seen.push(names(outer.impl, a)));
    nested.impl.dispose();
    expect(names(outer.impl, a)).toEqual(['outer', 'outer-item']);
    expect(child.impl.port.resolveDomainScope(a)).toBeNull();
    expect(() => child.impl.port.parts(a)).toThrow(/valid domain/);
    expect(seen.flat()).not.toContain('nested-item');
    child.impl.dispose();
    expect(names(outer.impl, a)).toEqual(['outer', 'outer-item']);
  });
  it('retires item descendants as one boundary rather than borrowing an ancestor item', () => {
    const a = family('terminal-part');
    const { node } = fixture();
    const outer = node('root', null, [[a, 'root']]);
    const item = node('item', outer.token, [[a, 'item']]);
    const trigger = node('trigger', item.token, [[a, 'trigger']]);
    const seen: unknown[][] = [];
    outer.impl.port.subscribeOrder(a, () => seen.push(names(outer.impl, a)));
    item.impl.dispose();
    expect(names(outer.impl, a)).toEqual(['root']);
    expect(trigger.impl.port.resolveDomainScope(a)).toBeNull();
    expect(seen).toEqual([['root']]);
  });
  it('revokes all owner families before notifying either family', () => {
    const a = family('terminal-atomic-a'),
      b = family('terminal-atomic-b');
    const { node } = fixture();
    const outer = node('outer', null, [
      [a, 'root'],
      [b, 'root'],
    ]);
    const item = node('item', outer.token, [
      [a, 'item'],
      [b, 'item'],
    ]);
    const snapshots: unknown[][] = [];
    outer.impl.port.subscribeOrder(a, () => snapshots.push(names(outer.impl, b)));
    item.impl.dispose();
    expect(snapshots).toEqual([['outer']]);
  });
  it('permits actual surviving-child adoption after leaving the retired boundary', () => {
    const a = family('terminal-adoption');
    const { node, parents } = fixture();
    const outer = node('outer', null, [[a, 'root']]);
    const nested = node('nested', outer.token, [[a, 'root']]);
    const child = node('child', nested.token, [[a, 'item']]);
    nested.impl.dispose();
    expect(names(outer.impl, a)).toEqual(['outer']);
    parents.set(child.token, outer.token);
    child.impl.port.syncStructure();
    expect(names(outer.impl, a)).toEqual(['outer', 'child']);
    expect(child.impl.port.resolveDomainScope(a)).toBe(outer.token);
  });
  it('does not prune another renderer tree through a foreign ancestry getter', () => {
    const a = family('terminal-independent-renderers');
    const first = fixture(),
      second = fixture();
    const outerA = first.node('outer-a', null, [[a, 'root']]);
    const itemA = first.node('item-a', outerA.token, [[a, 'item']]);
    const outerB = second.node('outer-b', null, [[a, 'root']]);
    const nestedB = second.node('nested-b', outerB.token, [[a, 'root']]);
    const childB = second.node('child-b', nestedB.token, [[a, 'item']]);
    nestedB.impl.dispose();
    expect(childB.impl.port.resolveDomainScope(a)).toBeNull();
    itemA.impl.dispose();
    expect(childB.impl.port.resolveDomainScope(a)).toBeNull();
    expect(names(outerB.impl, a)).toEqual(['outer-b']);
    first.node('new-a', outerA.token, [[a, 'item']]).impl.port.syncStructure();
    expect(childB.impl.port.resolveDomainScope(a)).toBeNull();
  });
  it('retains a live claim boundary while its host caps are temporarily unavailable', () => {
    const a = family('terminal-transient-caps');
    const first = fixture(),
      second = fixture();
    const outerA = first.node('outer-a', null, [[a, 'root']]);
    const itemA = first.node('item-a', outerA.token, [[a, 'item']]);
    const outerB = second.node('outer-b', null, [[a, 'root']]);
    const nestedB = second.node('nested-b', outerB.token, [[a, 'root']]);
    const childB = second.node('child-b', nestedB.token, [[a, 'item']]);
    nestedB.impl.dispose();
    const has = childB.caps.has.bind(childB.caps),
      get = childB.caps.get.bind(childB.caps);
    childB.caps.has = (cap: { id: string }) =>
      cap.id === ANATOMY_PARENT_CAP.id ? false : has(cap);
    childB.caps.get = (cap: { id: string }) => {
      if (cap.id === ANATOMY_PARENT_CAP.id) throw new Error('temporarily unavailable ancestry cap');
      return get(cap);
    };
    expect(() => itemA.impl.dispose()).not.toThrow();
    childB.caps.has = has;
    childB.caps.get = get;
    childB.caps.__bumpEpoch();
    expect(childB.impl.port.resolveDomainScope(a)).toBeNull();
    expect(names(outerB.impl, a)).toEqual(['outer-b']);
  });
  it('refreshes a claim ancestry getter when replacement caps become available', () => {
    const a = family('terminal-replaced-caps');
    const first = fixture(),
      second = fixture();
    const outerA = first.node('outer-a', null, [[a, 'root']]);
    const outerB = second.node('outer-b', null, [[a, 'root']]);
    const nestedB = second.node('nested-b', outerB.token, [[a, 'root']]);
    const childB = second.node('child-b', nestedB.token, [[a, 'item']]);
    nestedB.impl.dispose();
    let calls = 0;
    const replacement = (token: unknown) => {
      calls++;
      return second.parents.get(token) ?? null;
    };
    const get = childB.caps.get.bind(childB.caps);
    childB.caps.get = (cap: { id: string }) =>
      cap.id === ANATOMY_PARENT_CAP.id ? replacement : get(cap);
    childB.caps.__bumpEpoch();
    calls = 0;
    outerA.impl.port.syncStructure();
    expect(calls).toBeGreaterThan(0);
    expect(childB.impl.port.resolveDomainScope(a)).toBeNull();
  });
  it('does not retire a logical domain for repeatable view detach/remount', () => {
    const a = family('terminal-versus-detach');
    const { node } = fixture();
    const outer = node('outer', null, [[a, 'root']]);
    const nested = node('nested', outer.token, [[a, 'root']]);
    const child = node('child', nested.token, [[a, 'item']]);
    nested.impl.onMountPhase('unmounting', 1);
    nested.impl.onMountPhase('detached', 1);
    expect(names(nested.impl, a)).toEqual(['nested', 'child']);
    expect(names(outer.impl, a)).toEqual(['outer']);
    nested.impl.onMountPhase('mounted', 2);
    expect(child.impl.port.resolveDomainScope(a)).toBe(nested.token);
  });
});
