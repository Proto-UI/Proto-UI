// packages/modules/state/test/kernel.v0.test.ts
import { describe, it, expect } from 'vitest';
import { StateKernel } from '../src/kernel';

describe('state-kernel.v0', () => {
  it('define returns owned handle with get/setDefault/set', () => {
    const k = new StateKernel();
    const h = k.define('enabled', { kind: 'bool' }, false);

    expect(h.get()).toBe(false);

    h.setDefault(true);
    expect(h.get()).toBe(true);

    h.set(false);
    expect(h.get()).toBe(false);
  });

  it('setDefault does not emit; set emits only on change (Object.is)', () => {
    const k = new StateKernel();
    const h = k.define('count', { kind: 'number.discrete' }, 0);

    const events: Array<{ prev: number; next: number }> = [];
    k.subscribe(h, (e: any) => {
      // kernel emits only "next" events in v0
      if (e?.type === 'next') {
        events.push({ prev: e.prev, next: e.next });
      }
    });

    h.setDefault(1);
    expect(h.get()).toBe(1);
    expect(events.length).toBe(0);

    h.set(1);
    expect(events.length).toBe(0);

    h.set(2);
    expect(events).toEqual([{ prev: 1, next: 2 }]);

    // Object.is edge: NaN -> NaN should not emit
    h.set(Number.NaN);
    expect(events.length).toBe(2); // emitted (2 -> NaN)
    h.set(Number.NaN);
    expect(events.length).toBe(2); // no new emit
  });

  it('subscribers are FIFO, and unsubscribe works', () => {
    const k = new StateKernel();
    const h = k.define('x', { kind: 'number.discrete' }, 0);

    const calls: string[] = [];
    const off1 = k.subscribe(h, () => calls.push('a'));
    const off2 = k.subscribe(h, () => calls.push('b'));
    const off3 = k.subscribe(h, () => calls.push('c'));

    h.set(1);
    expect(calls.join('')).toBe('abc');

    calls.length = 0;
    off2();
    h.set(2);
    expect(calls.join('')).toBe('ac');

    off1();
    off3();
    calls.length = 0;
    h.set(3);
    expect(calls.length).toBe(0);
  });

  it('re-entrant set during emit is queued and flushed deterministically', () => {
    const k = new StateKernel();
    const h = k.define('x', { kind: 'number.discrete' }, 0);

    const seq: number[] = [];

    k.subscribe(h, (e: any) => {
      if (e?.type !== 'next') return;
      seq.push(e.next);
      if (e.next === 1) {
        // re-entrant set
        h.set(2);
      }
      if (e.next === 2) {
        h.set(3);
      }
    });

    h.set(1);
    expect(seq).toEqual([1, 2, 3]);
    expect(h.get()).toBe(3);
  });

  it('preserves queued re-entrant transitions when a later subscriber aborts an emit', () => {
    const k = new StateKernel();
    const h = k.define('x', { kind: 'number.discrete' }, 0);
    const firstSeen: number[] = [];
    const secondSeen: number[] = [];

    k.subscribe(h, (e: any) => {
      if (e?.type !== 'next') return;
      firstSeen.push(e.next);
      if (e.next === 1) h.set(2);
    });
    k.subscribe(h, (e: any) => {
      if (e?.type !== 'next') return;
      if (e.next === 1) throw new Error('reject transition');
      secondSeen.push(e.next);
    });

    expect(() => h.set(1)).toThrow('reject transition');
    expect(firstSeen).toEqual([1, 2]);
    expect(secondSeen).toEqual([2]);
    expect(h.get()).toBe(2);
  });

  it('rejects a pre-set validator before changing state or notifying subscribers', () => {
    const k = new StateKernel();
    const h = k.define('x', { kind: 'number.discrete' }, 2);
    const seen: number[] = [];

    k.beforeSet(h, (_prev, next) => {
      if (next === 0) throw new Error('invalid state');
    });
    k.subscribe(h, (e: any) => {
      if (e?.type === 'next') seen.push(e.next);
    });

    expect(() => h.set(0)).toThrow('invalid state');
    expect(h.get()).toBe(2);
    expect(seen).toEqual([]);

    h.set(3);
    expect(h.get()).toBe(3);
    expect(seen).toEqual([3]);
  });

  it('rolls back a reentrant validation failure and keeps recovery writes ordered', () => {
    const k = new StateKernel();
    const h = k.define('x', { kind: 'number.discrete' }, 2);
    const seen: Array<[number, number]> = [];

    k.beforeSet(h, (_prev, next) => {
      if (next === 0) throw new Error('invalid state');
    });
    k.subscribe(h, (e: any) => {
      if (e?.type !== 'next') return;
      seen.push([e.prev, e.next]);
      if (e.next === 3) h.set(0); // reentrant invalid write, not swallowed
    });

    expect(() => h.set(3)).toThrow('invalid state');
    expect(h.get()).toBe(2); // whole transaction restored to the pre-dispatch value
    expect(seen).toEqual([[2, 3]]); // 2→3 observed; 3→0 never committed or notified

    h.set(4); // recovery after the caller caught the rejection
    expect(h.get()).toBe(4);
    expect(seen).toEqual([
      [2, 3],
      [2, 4], // deterministic 2→4, never a stale 3→0
    ]);
  });
});
