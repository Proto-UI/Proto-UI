import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnatomyFamily } from '@proto.ui/core';
import type { AnatomyRootTargetGetter } from '../src/caps';
import { AnatomyModuleImpl } from '../src/impl';
import { makeCaps } from './utils/fake-caps';

const cleanup: AnatomyModuleImpl[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const owner of cleanup.splice(0).reverse()) owner.dispose();
});

function fixture(getRootTarget?: AnatomyRootTargetGetter) {
  const family = createAnatomyFamily('subscriber-fanout', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      item: { cardinality: { min: 0, max: '*' } },
    },
  });
  const rootToken = {};
  const getParent = (instance: unknown) => (instance === rootToken ? null : rootToken);
  const make = (role?: 'root' | 'item') => {
    const token = role === 'root' ? rootToken : {};
    const caps = makeCaps({
      instance: token,
      getParent,
      getPrototype: () => ({ name: 'fanout-owner', setup() {} }),
      getRootTarget,
    });
    const owner = new AnatomyModuleImpl(caps, 'fanout-owner', {
      get: () => undefined,
      getAll: () => ({}),
      has: () => false,
      keys: () => [],
    });
    cleanup.push(owner);
    if (role) owner.claim(family, { role });
    return owner;
  };
  const root = make('root');
  return { family, root, make, notify: () => root.port.syncStructure() };
}

describe('Anatomy family subscriber notification', () => {
  it('uses the current host comparator when the target identity is unchanged', () => {
    const itemTarget = { compareDocumentPosition: () => 2 };
    const rootTarget = { compareDocumentPosition: () => 4 };
    let rootReads = 0;
    let replaceComparator = false;
    let rootInstance: unknown;
    const f = fixture((instance) => {
      if (instance !== rootInstance) return itemTarget;
      if (replaceComparator && ++rootReads === 2) {
        itemTarget.compareDocumentPosition = () => 4;
        rootTarget.compareDocumentPosition = () => 2;
      }
      return rootTarget;
    });
    rootInstance = f.root.port.resolveSelfInstance();
    f.make('item');
    const first = f.make();
    const second = f.make();
    const firstOrder = vi.fn();
    const secondOrder = vi.fn();
    first.port.subscribeOrder(f.family, firstOrder);
    second.port.subscribeOrder(f.family, secondOrder);

    replaceComparator = true;
    f.notify();
    expect(firstOrder).not.toHaveBeenCalled();
    expect(secondOrder).toHaveBeenCalledTimes(1);
  });

  it('does not inspect unrelated owners when one family publishes a structural change', () => {
    const f = fixture();
    const listener = f.make('item');
    const order = vi.fn();
    const target = vi.fn();
    listener.port.subscribeOrder(f.family, order);
    listener.port.subscribeTargets(f.family, target);
    // Instrument the map operations with this exact family token, without
    // reading private fields or using wall-clock thresholds. Unclaimed owners
    // are otherwise real modules with the same host bridge.
    const has = vi.spyOn(Map.prototype, 'has');
    const get = vi.spyOn(Map.prototype, 'get');
    f.notify();
    const baseline = [...has.mock.calls, ...get.mock.calls].filter(
      ([key]) => key === f.family
    ).length;
    expect(target).toHaveBeenCalledTimes(1);
    expect(order).not.toHaveBeenCalled();
    for (let index = 0; index < 128; index++) f.make();
    has.mockClear();
    get.mockClear();
    f.notify();
    const unrelated = [...has.mock.calls, ...get.mock.calls].filter(
      ([key]) => key === f.family
    ).length;
    expect(target).toHaveBeenCalledTimes(2);
    expect(order).not.toHaveBeenCalled();
    expect(unrelated).toBe(baseline);
    has.mockRestore();
    get.mockRestore();
    f.make('item');
    f.notify();
    expect(order).toHaveBeenCalledTimes(1);
    expect(target).toHaveBeenCalledTimes(3);
  });

  for (const kind of ['order', 'target'] as const) {
    const subscribe = (
      owner: AnatomyModuleImpl,
      family: ReturnType<typeof createAnatomyFamily>,
      cb: () => void
    ) =>
      kind === 'order'
        ? owner.port.subscribeOrder(family, cb)
        : owner.port.subscribeTargets(family, cb);

    it(`${kind}: retains owner creation order when subscription order differs`, () => {
      const f = fixture();
      const first = f.make('item');
      const second = f.make('item');
      const events: string[] = [];
      subscribe(second, f.family, () => events.push('second'));
      subscribe(first, f.family, () => events.push('first'));
      f.make('item');
      f.notify();
      expect(events).toEqual(['first', 'second']);
    });

    it(`${kind}: skips cancelled and disposed recipients during synchronous reentry`, () => {
      const f = fixture();
      const first = f.make('item');
      const second = f.make('item');
      const third = f.make('item');
      const events: string[] = [];
      const cancelSecond = subscribe(second, f.family, () => events.push('second'));
      subscribe(third, f.family, () => events.push('third'));
      let reentered = false;
      subscribe(first, f.family, () => {
        events.push('first');
        if (reentered) return;
        reentered = true;
        cancelSecond();
        third.dispose();
      });
      f.make('item');
      f.notify();
      // Disposing a claimed recipient starts a nested structural notification.
      expect(events).toEqual(kind === 'order' ? ['first', 'first'] : ['first']);
    });

    it(`${kind}: observes later owners subscribed by a callback but never revisits earlier owners`, () => {
      const f = fixture();
      const earlier = f.make('item');
      const first = f.make('item');
      const later = f.make('item');
      const events: string[] = [];
      subscribe(first, f.family, () => {
        events.push('first');
        subscribe(earlier, f.family, () => events.push('earlier'));
        subscribe(later, f.family, () => events.push('later'));
      });
      f.make('item');
      f.notify();
      // Order subscriptions prime their current signature on acquisition, so
      // the new recipient is visited without manufacturing an initial event.
      expect(events).toEqual(kind === 'order' ? ['first'] : ['first', 'later']);
      events.length = 0;
      f.make('item');
      f.notify();
      expect(events.slice(0, 2)).toEqual(['earlier', 'first']);
      expect(events.filter((value) => value === 'later')).toHaveLength(2);
    });
  }

  it('does not reactivate disposed owners or repeat notifications after the last cancellation', () => {
    const f = fixture();
    const owner = f.make('item');
    const target = vi.fn();
    const cancel = owner.port.subscribeTargets(f.family, target);
    f.notify();
    expect(target).toHaveBeenCalledTimes(1);
    cancel();
    f.notify();
    expect(target).toHaveBeenCalledTimes(1);
    owner.port.subscribeTargets(f.family, target);
    owner.dispose();
    owner.port.subscribeTargets(f.family, target);
    f.notify();
    expect(target).toHaveBeenCalledTimes(1);
  });

  it('continues into a recreated family index after the current recipient cancels itself', () => {
    const f = fixture();
    const first = f.make('item');
    const events: string[] = [];
    const cancel = first.port.subscribeTargets(f.family, () => {
      events.push('first');
      cancel();
      const newlyCreated = f.make();
      newlyCreated.port.subscribeTargets(f.family, () => events.push('new'));
    });
    f.notify();
    expect(events).toEqual(['first', 'new']);
    events.length = 0;
    f.notify();
    expect(events).toEqual(['new']);
  });

  it('preserves synchronous callback failures and fresh traversal on the next publication', () => {
    const f = fixture();
    const first = f.make('item');
    const second = f.make('item');
    const failure = new Error('subscriber failed');
    const events: string[] = [];
    const cancel = first.port.subscribeTargets(f.family, () => {
      events.push('first');
      throw failure;
    });
    second.port.subscribeTargets(f.family, () => events.push('second'));
    expect(f.notify).toThrow(failure);
    expect(events).toEqual(['first']);
    cancel();
    f.notify();
    expect(events).toEqual(['first', 'second']);
  });
});
