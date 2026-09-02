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
});
