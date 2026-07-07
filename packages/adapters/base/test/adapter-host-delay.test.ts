import { afterEach, describe, expect, it, vi } from 'vitest';
import { delay, type Prototype } from '@proto.ui/core';
import { createAdapterHost } from '../src';

describe('adapter-base: adapter host delay scheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('provides a default JS delay scheduler when the adapter host does not supply one', () => {
    vi.useFakeTimers();
    const calls: string[] = [];

    const proto: Prototype = {
      name: 'x-adapter-base-delay-default',
      setup(def) {
        def.lifecycle.onCreated(() => {
          delay(20, () => calls.push('delay'));
        });

        return (r) => [r.el('div', 'ok')];
      },
    };

    createAdapterHost(proto, {
      getRawProps() {
        return {};
      },
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
    });

    expect(calls).toEqual([]);

    vi.advanceTimersByTime(19);
    expect(calls).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['delay']);
  });
});
