// @vitest-environment node
import { expect, it } from 'vitest';
import { emitRecordedNotification } from '../src/notification-plan';

it('owns notification entries and failures despite inherited numeric setters', () => {
  const create = new Function(`
    const pending = [], subscribers = new Set(); let draining = false;
    function publish(next) {
      ${emitRecordedNotification({ queue: 'pending', draining: 'draining', subscribers: 'subscribers', deliver: 'subscriber(next)', typed: false })}
    }
    return {publish, subscribe(fn) { subscribers.add(fn); }};
  `) as () => { publish(next: number): void; subscribe(fn: (next: number) => void): void };
  const queue = create();
  let trace = '',
    setterCalls = 0;
  queue.subscribe((next) => {
    trace += `a${next};`;
    if (next === 1) {
      queue.publish(2);
      throw 0;
    }
    if (next === 2) throw false;
  });
  queue.subscribe((next) => {
    trace += `b${next};`;
  });
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, '0');
  let failure: unknown;
  try {
    Object.defineProperty(Object.prototype, '0', {
      configurable: true,
      get() {
        return 99;
      },
      set() {
        ++setterCalls;
      },
    });
    try {
      queue.publish(1);
    } catch (error) {
      failure = error;
    }
  } finally {
    if (previous) Object.defineProperty(Object.prototype, '0', previous);
    else Reflect.deleteProperty(Object.prototype, '0');
  }
  expect(setterCalls).toBe(0);
  expect(trace).toBe('a1;b1;a2;b2;');
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as AggregateError).errors).toEqual([0, false]);
  queue.publish(3);
  expect(trace).toBe('a1;b1;a2;b2;a3;b3;');
});
