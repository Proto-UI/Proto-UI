import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import type { StateEvent, StateSpec } from '@proto.ui/types';
import { StateKernel } from '../src/kernel';

const spec = { kind: 'number.list' } as const;

describe('draft number.list snapshots', () => {
  it('copies and freezes complete snapshots without freezing caller inputs or rewriting history', () => {
    const kernel = new StateKernel();
    const input = [2, -0, 2];
    const state = kernel.define<readonly number[]>('coordinates', spec, input);
    const initial = state.get();
    expect(initial).toEqual([2, 0, 2]);
    expect(Object.is(initial[1], -0)).toBe(false);
    expect(initial).not.toBe(input);
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(input)).toBe(false);
    input[0] = 99;
    expect(initial).toEqual([2, 0, 2]);
    const events: StateEvent<readonly number[]>[] = [];
    kernel.subscribe(state, (event) => events.push(event));
    const next = [4, 8];
    state.set(next);
    next.push(100);
    state.set([]);
    expect(events).toEqual([
      { type: 'next', prev: [2, 0, 2], next: [4, 8], reason: undefined },
      { type: 'next', prev: [4, 8], next: [], reason: undefined },
    ]);
    for (const event of events)
      if (event.type === 'next') {
        expect(Object.isFrozen(event.prev)).toBe(true);
        expect(Object.isFrozen(event.next)).toBe(true);
        expect(() => (event.prev as number[]).push(1)).toThrow();
      }
    expect(JSON.parse(JSON.stringify(initial))).toEqual(initial);
  });

  it('normalizes cross-realm arrays and pure Array subclasses without retaining class identity', () => {
    const kernel = new StateKernel();
    const crossRealm = runInNewContext('[1, 2]');
    const subclass = new (class extends Array<number> {})(1, 2);
    for (const input of [crossRealm, subclass]) {
      const state = kernel.define('coordinates', spec, input);
      expect(state.get()).toEqual([1, 2]);
      expect(Object.getPrototypeOf(state.get())).toBe(Array.prototype);
      expect(state.get()).not.toBe(input);
      expect(Object.isFrozen(input)).toBe(false);
    }
  });

  it('never treats inherited descriptor-table entries as own dense array elements', () => {
    const kernel = new StateKernel();
    const input = Object.assign(new Array(1), { extra: 1 });
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, '0');
    let failure: unknown;
    try {
      Object.defineProperty(Object.prototype, '0', {
        value: { value: 7 },
        configurable: true,
        writable: true,
      });
      try {
        kernel.define('invalid', spec, input);
      } catch (error) {
        failure = error;
      }
    } finally {
      if (previous) Object.defineProperty(Object.prototype, '0', previous);
      else delete (Object.prototype as any)[0];
    }
    expect(failure).toBeInstanceOf(Error);
    const valid = kernel.define('coordinates', spec, Object.setPrototypeOf([1, 2], null));
    expect((valid as any).__stateId).toBe(1);
    expect(valid.get()).toEqual([1, 2]);
    expect(Object.getPrototypeOf(valid.get())).toBe(Array.prototype);
  });

  it('rejects accessor descriptors even when value is inherited on Object.prototype', () => {
    const kernel = new StateKernel();
    let getterCalls = 0;
    const input = Object.defineProperty([1], '0', {
      get() {
        getterCalls++;
        return 1;
      },
    });
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, 'value');
    let failure: unknown;
    try {
      Object.defineProperty(Object.prototype, 'value', {
        value: 7,
        configurable: true,
        writable: true,
      });
      try {
        kernel.define('invalid', spec, input);
      } catch (error) {
        failure = error;
      }
    } finally {
      delete (Object.prototype as any).value;
      if (previous) Object.defineProperty(Object.prototype, 'value', previous);
    }
    expect(failure).toBeInstanceOf(Error);
    expect(getterCalls).toBe(0);
    const valid = kernel.define('coordinates', spec, [1]);
    expect((valid as any).__stateId).toBe(1);
  });

  it('copies and freezes the source descriptor independently from the caller', () => {
    const kernel = new StateKernel();
    const callerSpec: StateSpec = { kind: 'number.list' };
    const state = kernel.define('coordinates', callerSpec, [1]);
    const sourceSpec = (state as any).__stateSpec;
    expect(sourceSpec).not.toBe(callerSpec);
    expect(Object.isFrozen(sourceSpec)).toBe(true);
    expect(Object.isFrozen(callerSpec)).toBe(false);
    (callerSpec as any).kind = 'number.discrete';
    expect((state as any).__stateKind).toBe('number.list');
    expect(sourceSpec).toEqual(spec);
    expect(() => state.set([Infinity])).toThrow();
    expect(state.get()).toEqual([1]);
  });

  it('retains identity for equal content, keeps setDefault silent, and treats order as meaningful', () => {
    const kernel = new StateKernel();
    const state = kernel.define<readonly number[]>('coordinates', spec, [1, 0, 1]);
    const first = state.get();
    const events: unknown[] = [];
    kernel.subscribe(state, (event) => events.push(event));
    state.set([1, -0, 1]);
    state.setDefault([1, 0, 1]);
    expect(state.get()).toBe(first);
    expect(events).toHaveLength(0);
    const defaults = [3, 1];
    state.setDefault(defaults);
    defaults[0] = 99;
    expect(state.get()).toEqual([3, 1]);
    expect(events).toHaveLength(0);
    state.set([1, 3]);
    expect(events).toHaveLength(1);
  });

  it('rejects invalid dense-data inputs without evaluating getters or allocating/mutating a slot', () => {
    const kernel = new StateKernel();
    let getterCalls = 0;
    const accessor = Object.defineProperty([1], '0', {
      get() {
        getterCalls++;
        return 1;
      },
    });
    const extraAccessor = Object.defineProperty([1], 'extra', {
      get() {
        getterCalls++;
        return 1;
      },
    });
    const symbol = Object.assign([1], { [Symbol('extra')]: 1 });
    const invalid = [
      null,
      {},
      new Float64Array([1]),
      new Array(1),
      [undefined],
      [NaN],
      [Infinity],
      [-Infinity],
      [[1]],
      [{}],
      accessor,
      extraAccessor,
      symbol,
      Object.assign([1], { extra: 2 }),
    ];
    for (const value of invalid) expect(() => kernel.define('bad', spec, value)).toThrow();
    const state = kernel.define<readonly number[]>('coordinates', spec, [1]);
    expect((state as any).__stateId).toBe(1);
    const initial = state.get();
    const events: unknown[] = [];
    kernel.subscribe(state, (event) => events.push(event));
    for (const value of invalid) {
      expect(() => state.set(value as any)).toThrow();
      expect(() => state.setDefault(value as any)).toThrow();
      expect(state.get()).toBe(initial);
    }
    expect(events).toHaveLength(0);
    expect(getterCalls).toBe(0);
  });

  it('preserves deterministic re-entrant complete transitions and ignores repeated content', () => {
    const kernel = new StateKernel();
    const state = kernel.define<readonly number[]>('coordinates', spec, [0, 10]);
    const events: unknown[] = [];
    kernel.subscribe(state, (event) => {
      events.push(event);
      if (event.type === 'next' && event.next[0] === 1) {
        expect(() => state.set([NaN])).toThrow();
        state.set([2, 8]);
        state.set([2, 8]);
      }
    });
    state.set([1, 9]);
    expect(events).toEqual([
      { type: 'next', prev: [0, 10], next: [1, 9], reason: undefined },
      { type: 'next', prev: [1, 9], next: [2, 8], reason: undefined },
    ]);
  });

  it('does not silently change legacy scalar Object.is or validation behavior', () => {
    const kernel = new StateKernel();
    const state = kernel.define('scalar', { kind: 'number.discrete' }, 0);
    const events: unknown[] = [];
    kernel.subscribe(state, (event) => events.push(event));
    state.set(-0);
    state.set(NaN);
    state.set(NaN);
    expect(events).toHaveLength(2);
    expect(state.get()).toBeNaN();
  });
});
