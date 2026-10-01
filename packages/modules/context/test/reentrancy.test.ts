import { describe, expect, it } from 'vitest';
import { createContextKey } from '@proto.ui/core';
import { ContextCenter } from '../src/center';

// C-CONTEXT-0010 F/G/H: no DOM or Runtime substitution is needed for ordering.
function fixture(owner: unknown = {}) {
  const center = new ContextCenter(),
    key = createContextKey<{ value: number }>('j1');
  const first = {},
    last = {},
    other = {};
  const parents = new Map<unknown, unknown>([
    [first, owner],
    [last, owner],
  ]);
  const parent = (token: unknown) => parents.get(token) ?? null;
  center.provide(owner, key, { value: 0 });
  center.provide(other, key, { value: 10 });
  const update = (value: number) => center.updateFromProvider(owner, key, { value }, {}, parent);
  return { center, key, owner, first, last, other, parents, parent, update };
}
describe('J1 Context reentrant delivery', () => {
  it('preserves Map identity for NaN providers through queued reentrant delivery', () => {
    const f = fixture(NaN),
      seen: number[] = [];
    f.center.subscribe(f.first, f.key, 'required', (_, next) => {
      if (next!.value === 1) f.update(2);
    });
    f.center.subscribe(f.last, f.key, 'required', (_, next) => seen.push(next!.value as number));
    f.update(1);
    expect(seen).toEqual([1, 2]);
    expect(f.center.dumpCallbackQueue()).toEqual([]);
  });
  it('preserves each transition, immediate reads and nested-return timing without recursive dispatch', () => {
    const f = fixture(),
      seen: Array<[string, number, number]> = [];
    f.center.subscribe(f.first, f.key, 'required', (_, next, prev) => {
      seen.push(['first', prev!.value as number, next!.value as number]);
      if (next!.value === 1) {
        f.update(2);
        f.update(3);
        expect(f.center.getProviderValue(f.owner, f.key)).toEqual({ value: 3 });
        expect(seen).toEqual([['first', 0, 1]]);
      }
    });
    f.center.subscribe(f.last, f.key, 'required', (_, next, prev) =>
      seen.push(['last', prev!.value as number, next!.value as number])
    );
    f.update(1);
    expect(seen).toEqual([
      ['first', 0, 1],
      ['last', 0, 1],
      ['first', 1, 2],
      ['last', 1, 2],
      ['first', 2, 3],
      ['last', 2, 3],
    ]);
    expect(f.center.dumpCallbackQueue()).toEqual([]);
  });
  it.each(['remove', 'rebind'])('rechecks recipient eligibility after %s', (kind) => {
    const f = fixture(),
      seen: number[] = [];
    f.center.subscribe(f.first, f.key, 'required', (_, next) => {
      if (next!.value !== 1) return;
      f.update(2);
      if (kind === 'remove') f.center.removeInstance(f.last);
      else f.parents.set(f.last, f.other);
    });
    f.center.subscribe(f.last, f.key, 'required', (_, next) => seen.push(next!.value as number));
    f.update(1);
    expect(seen).toEqual([]);
    expect(f.center.dumpCallbackQueue()).toEqual([]);
  });
  it('does not deliver old work to replaced provider or subscription generations', () => {
    const f = fixture(),
      seen: number[] = [];
    f.center.subscribe(f.first, f.key, 'required', (_, next) => {
      if (next!.value !== 1) return;
      f.update(2);
      f.center.unprovide(f.owner, f.key);
      f.center.provide(f.owner, f.key, { value: 10 });
      f.center.removeInstance(f.last);
      f.center.subscribe(f.last, f.key, 'required', (_, value) =>
        seen.push(value!.value as number)
      );
      f.update(11);
    });
    f.center.subscribe(f.last, f.key, 'required', () => {
      throw Error('disposed callback');
    });
    f.update(1);
    expect(seen).toEqual([11]);
    expect(f.center.dumpCallbackQueue()).toEqual([]);
  });
  it('does not replay transitions to callbacks registered after commit', () => {
    const f = fixture(),
      seen: number[] = [];
    f.center.subscribe(f.first, f.key, 'required', (_, next) => {
      if (next!.value !== 1) return;
      f.update(2);
      f.center.subscribe(f.last, f.key, 'required', (_, value) =>
        seen.push(value!.value as number)
      );
    });
    f.update(1);
    expect(seen).toEqual([]);
    f.update(3);
    expect(seen).toEqual([3]);
  });
  it('drains finite eligible delivery before reporting errors and has no stale replay', () => {
    const f = fixture(),
      seen: number[] = [],
      problem = Error('subscriber');
    f.center.subscribe(f.first, f.key, 'required', (_, next) => {
      if (next!.value === 1) {
        f.update(2);
        throw problem;
      }
    });
    f.center.subscribe(f.last, f.key, 'required', (_, next) => seen.push(next!.value as number));
    expect(() => f.update(1)).toThrow(problem);
    expect(seen).toEqual([1, 2]);
    expect(f.center.dumpCallbackQueue()).toEqual([]);
    f.update(3);
    expect(seen).toEqual([1, 2, 3]);
  });
  it('aggregates multiple callback errors without discarding other recipients', () => {
    const f = fixture(),
      a = Error('a'),
      b = Error('b'),
      seen: number[] = [];
    f.center.subscribe(f.first, f.key, 'required', () => {
      throw a;
    });
    f.center.subscribe(f.first, f.key, 'required', () => {
      throw b;
    });
    f.center.subscribe(f.last, f.key, 'required', (_, next) => seen.push(next!.value as number));
    let error: unknown;
    try {
      f.update(1);
    } catch (e) {
      error = e;
    }
    expect((error as AggregateError).errors).toEqual([a, b]);
    expect(seen).toEqual([1]);
    expect(f.center.dumpCallbackQueue()).toEqual([]);
  });
  it('keeps independent provider queues independent during nested delivery', () => {
    const f = fixture(),
      otherConsumer = {},
      seen: number[] = [];
    f.parents.set(otherConsumer, f.other);
    f.center.subscribe(otherConsumer, f.key, 'required', (_, next) =>
      seen.push(next!.value as number)
    );
    f.center.subscribe(f.first, f.key, 'required', () => {
      f.center.updateFromProvider(f.other, f.key, { value: 11 }, {}, f.parent);
      expect(seen).toEqual([11]);
    });
    f.update(1);
    expect(f.center.dumpCallbackQueue()).toEqual([]);
  });
});
