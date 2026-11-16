import { describe, expect, it } from 'vitest';
import { StateKernel } from '../src/kernel';

describe('C-STATE-0011 recorded notification order', () => {
  it('drains reentrant transitions after an exception and never leaks them into the next write', () => {
    const kernel = new StateKernel();
    const state = kernel.define('count', { kind: 'number.discrete' }, 0);
    const trace: string[] = [];
    const failure = new Error('subscriber failed');
    let offB = () => {};
    kernel.subscribe(state, (event) => {
      if (event.type !== 'next') return;
      trace.push(`a${event.next}`);
      if (event.next === 1) {
        offB();
        kernel.subscribe(state, (e) => {
          if (e.type === 'next') trace.push(`c${e.next}`);
        });
        state.set(2);
        throw failure;
      }
    });
    offB = kernel.subscribe(state, (event) => {
      if (event.type === 'next') trace.push(`b${event.next}`);
    });
    expect(() => state.set(1)).toThrow(failure);
    expect(state.get()).toBe(2);
    expect(trace).toEqual(['a1', 'a2', 'c2']);
    state.set(3);
    expect(trace).toEqual(['a1', 'a2', 'c2', 'a3', 'c3']);
  });

  it('uses registration identity when the same callback is removed and registered again', () => {
    const kernel = new StateKernel();
    const state = kernel.define('count', { kind: 'number.discrete' }, 0);
    const trace: string[] = [];
    const b = (event: { type: string; next?: number }) => {
      if (event.type === 'next') trace.push(`b${event.next}`);
    };
    let offB = () => {};
    kernel.subscribe(state, (event) => {
      if (event.type !== 'next') return;
      trace.push(`a${event.next}`);
      if (event.next === 1) {
        offB();
        kernel.subscribe(state, b);
        state.set(2);
      }
    });
    offB = kernel.subscribe(state, b);
    state.set(1);
    expect(trace).toEqual(['a1', 'a2', 'b2']);
  });

  it('preserves every thrown value and delivers other registrations before reporting failure', () => {
    const kernel = new StateKernel();
    const state = kernel.define('count', { kind: 'number.discrete' }, 0);
    const trace: number[] = [];
    kernel.subscribe(state, () => {
      throw undefined;
    });
    kernel.subscribe(state, () => {
      throw 'second';
    });
    kernel.subscribe(state, (event) => {
      if (event.type === 'next') trace.push(event.next);
    });
    try {
      state.set(1);
      expect.fail('Expected aggregate failure');
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toEqual([undefined, 'second']);
    }
    expect(trace).toEqual([1]);
  });
});
