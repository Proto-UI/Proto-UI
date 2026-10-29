import { describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createAdapterHost } from '../src';

describe('adapter-base: adapter host', () => {
  it.each([
    { name: 'undefined', value: undefined },
    { name: 'null', value: null },
    { name: 'false', value: false },
    { name: 'zero', value: 0 },
    { name: 'empty string', value: '' },
    { name: 'Error', value: new Error('afterUnmount failure') },
  ])('rejects a synchronous terminal afterUnmount throw: $name', async ({ value }) => {
    const proto = definePrototype({ name: 'x-after-unmount-failure', setup() {} });
    let calls = 0;
    const host = createAdapterHost(
      proto,
      {
        getRawProps: () => ({}),
        schedule: (task) => task(),
        commit: (_v, signal) => signal?.done(),
      },
      {
        afterUnmount() {
          calls += 1;
          throw value;
        },
      },
      { initialMount: 'manual' }
    );
    const pending = host.dispose();
    let rejected = false;
    let error: unknown;
    await pending.then(
      () => {},
      (failure) => {
        rejected = true;
        error = failure;
      }
    );
    expect(rejected).toBe(true);
    expect(error).toBe(value);
    expect(calls).toBe(1);
    expect(host.dispose()).toBe(pending);
  });

  it('preserves the Runtime failure over a secondary afterUnmount failure', async () => {
    const primary = new Error('runtime disposal failure');
    const secondary = new Error('afterUnmount failure');
    const proto = definePrototype({
      name: 'x-after-unmount-primary',
      setup(def) {
        def.lifecycle.onBeforeDispose(() => {
          throw primary;
        });
      },
    });
    let calls = 0;
    const host = createAdapterHost(
      proto,
      {
        getRawProps: () => ({}),
        schedule: (task) => task(),
        commit: (_v, signal) => signal?.done(),
      },
      {
        afterUnmount() {
          calls += 1;
          throw secondary;
        },
      },
      { initialMount: 'manual' }
    );
    await expect(host.dispose()).rejects.toBe(primary);
    expect(calls).toBe(1);
  });

  it('can create an alive detached session without performing the first mount', async () => {
    const commit = vi.fn((_children, signal) => signal?.done());
    const proto = definePrototype({
      name: 'x-manual-adapter-host',
      setup(def) {
        def.lifecycle.onCreated((run) => run.lifecycle.setPresent(false));
        return (renderer) => renderer.el('div', 'ok');
      },
    });

    const host = createAdapterHost(
      proto,
      {
        getRawProps: () => ({}),
        schedule: (task) => task(),
        commit,
      },
      {},
      { initialMount: 'manual' }
    );

    expect(host.viewIntent.getSnapshot()).toEqual({ present: false, version: 1 });
    expect(commit).not.toHaveBeenCalled();

    await host.mount();
    expect(commit).toHaveBeenCalledOnce();

    await host.dispose();
  });
});
