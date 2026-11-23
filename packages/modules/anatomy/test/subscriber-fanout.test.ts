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
  it('observes comparator replacement during repeated host reads for a later recipient', () => {
    type Target = { rank: number; compareDocumentPosition(other: unknown): number };
    const forward = function (this: Target, other: unknown) {
      return this.rank < (other as Target).rank ? 4 : 2;
    };
    const reverse = function (this: Target, other: unknown) {
      return this.rank < (other as Target).rank ? 2 : 4;
    };
    const targets = new Map<unknown, Target>();
    let armed = false;
    let repeatedReads = 0;
    let repeatedInstance: unknown;
    const f = fixture((instance) => {
      if (armed && instance === repeatedInstance && ++repeatedReads === 5)
        for (const target of targets.values()) target.compareDocumentPosition = reverse;
      return targets.get(instance) ?? null;
    });
    const claims = [f.root, f.make('item'), f.make('item'), f.make('item')];
    for (const [index, rank] of [0, 3, 1, 2].entries()) {
      const instance = claims[index]!.port.resolveSelfInstance();
      targets.set(instance, { rank, compareDocumentPosition: forward });
      if (index === 1) repeatedInstance = instance;
    }
    const firstOrder = vi.fn();
    const secondOrder = vi.fn();
    f.make().port.subscribeOrder(f.family, firstOrder);
    f.make().port.subscribeOrder(f.family, secondOrder);
    // Controlled host reentry: the first recipient reads this claim three
    // times, then its second read for the later recipient replaces the method.
    // A once-per-claim validation would miss that live host change.
    armed = true;
    f.notify();
    expect(firstOrder).not.toHaveBeenCalled();
    expect(secondOrder).toHaveBeenCalledOnce();
  });

  it('keeps registration order when targets compare equal or are unavailable', () => {
    const targets = new Map<
      unknown,
      { rank: number; compareDocumentPosition(other: unknown): number }
    >();
    let unavailable = false;
    const f = fixture((instance) => (unavailable ? null : (targets.get(instance) ?? null)));
    const items = Array.from({ length: 4 }, () => f.make('item'));
    const instances = items.map((owner) => owner.port.resolveSelfInstance());
    for (const [index, instance] of instances.entries())
      targets.set(instance, {
        rank: instances.length - index,
        compareDocumentPosition(other) {
          const rank = (other as { rank: number }).rank;
          return this.rank < rank ? 4 : this.rank > rank ? 2 : 0;
        },
      });
    const ordered = () =>
      f.root.tryOrderedPartsOf(f.family, 'item')!.map(f.root.port.resolvePartInstance);
    expect(ordered()).toEqual([...instances].reverse());

    for (const target of targets.values()) target.rank = 0;
    expect(ordered()).toEqual(instances);
    unavailable = true;
    expect(ordered()).toEqual(instances);
  });

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

  it('advances through stable order and target subscribers without rereading owner order', () => {
    const f = fixture();
    const owners = Array.from({ length: 32 }, () => f.make());
    const order = vi.fn();
    const target = vi.fn();
    for (const owner of owners) {
      owner.port.subscribeOrder(f.family, order);
      owner.port.subscribeTargets(f.family, target);
    }
    const reads = vi.fn();
    const descriptors = owners.map((owner) => {
      const descriptor = Object.getOwnPropertyDescriptor(owner, 'instanceOrder')!;
      Object.defineProperty(owner, 'instanceOrder', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          reads();
          return descriptor.value;
        },
      });
      return descriptor;
    });
    const get = vi.spyOn(Map.prototype, 'get');
    let listReads: number;
    try {
      f.notify();
      listReads = get.mock.results.filter(
        (result) =>
          result.type === 'return' && Array.isArray(result.value) && result.value[0] === owners[0]
      ).length;
    } finally {
      get.mockRestore();
      owners.forEach((owner, index) =>
        Object.defineProperty(owner, 'instanceOrder', descriptors[index]!)
      );
    }
    expect(order).not.toHaveBeenCalled();
    expect(target).toHaveBeenCalledTimes(owners.length);
    expect(reads).not.toHaveBeenCalled();
    expect(listReads).toBe(2);
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
