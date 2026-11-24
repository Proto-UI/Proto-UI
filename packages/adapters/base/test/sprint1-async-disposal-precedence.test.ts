// @vitest-environment node
import { definePrototype } from '@proto.ui/core';
import { describe, expect, it } from 'vitest';
import { createAdapterHost } from '../src';

const failures = [
  { name: 'undefined', value: undefined },
  { name: 'null', value: null },
  { name: 'false', value: false },
  { name: 'zero', value: 0 },
  { name: 'empty string', value: '' },
  { name: 'Error', value: new Error('first Runtime failure') },
];

type Failure = { value: unknown };

function createReentrantFixture(options: {
  entry: 'begin' | 'unmounted';
  primary?: Failure;
  secondary?: Failure;
}) {
  const calls: string[] = [];
  const after: { stateReadable?: boolean; completion?: Promise<void> } = {};
  let state!: { get(): boolean };
  let terminal: Promise<void> | undefined;
  let host: ReturnType<typeof createAdapterHost>;
  const enterDisposal = () => {
    terminal = host.dispose();
    // The original unmount callback is still running. Runtime must keep its
    // logical resources until that callback has finished, without a mock
    // RuntimeSession, intercepted Promise, or fake framework scheduler.
    expect(state.get()).toBe(true);
    expect(host.dispose()).toBe(terminal);
    if (options.primary) throw options.primary.value;
  };
  const proto = definePrototype({
    name: 'sprint1-async-disposal-precedence',
    setup(def) {
      state = def.state.bool('alive', true);
      def.lifecycle.onUnmounted(() => {
        calls.push('unmounted');
        if (options.entry === 'unmounted') enterDisposal();
      });
      def.lifecycle.onBeforeDispose(() => calls.push('beforeDispose'));
      return (run) => run.el('div', 'alive');
    },
  });
  host = createAdapterHost(
    proto,
    {
      getRawProps: () => ({}),
      commit: (_children, signal) => signal?.done(),
      schedule: (task) => task(),
    },
    {
      onUnmountBegin() {
        calls.push('begin');
        if (options.entry === 'begin') enterDisposal();
      },
      afterUnmount() {
        calls.push('afterUnmount');
        try {
          state.get();
          after.stateReadable = true;
        } catch {
          after.stateReadable = false;
        }
        after.completion = host.dispose();
        if (options.secondary) throw options.secondary.value;
      },
    },
    { initialMount: 'manual' }
  );
  return { host, calls, after, state: () => state, terminal: () => terminal };
}

describe('adapter-base: actual asynchronous terminal error precedence', () => {
  for (const entry of ['begin', 'unmounted'] as const) {
    it.each(failures)(
      `retains the first $name error when ${entry} reenters disposal and afterUnmount throws`,
      async ({ value }) => {
        const secondary = new Error('secondary adapter cleanup failure');
        const fixture = createReentrantFixture({
          entry,
          primary: { value },
          secondary: { value: secondary },
        });
        await fixture.host.mount();
        const unmount = fixture.host.unmount();
        const terminal = fixture.terminal();
        expect(terminal).toBeDefined();
        expect(fixture.calls).toEqual(['begin', 'unmounted']);
        const [unmounted, disposed] = await Promise.allSettled([unmount, terminal]);
        expect(unmounted).toEqual({ status: 'rejected', reason: value });
        expect(disposed).toEqual({ status: 'rejected', reason: value });
        if (unmounted.status === 'rejected') expect(unmounted.reason).toBe(value);
        if (disposed.status === 'rejected') expect(disposed.reason).toBe(value);
        expect(fixture.calls).toEqual(['begin', 'unmounted', 'beforeDispose', 'afterUnmount']);
        expect(fixture.after.stateReadable).toBe(false);
        expect(fixture.after.completion).toBe(terminal);
        expect(fixture.host.dispose()).toBe(terminal);
        expect(() => fixture.state().get()).toThrow(/disposed/i);
        await expect(fixture.host.mount()).rejects.toThrow(/disposed/i);
      }
    );
  }

  it.each(failures)(
    'reports an afterUnmount-only $name failure after successful asynchronous Runtime cleanup',
    async ({ value }) => {
      const fixture = createReentrantFixture({
        entry: 'unmounted',
        secondary: { value },
      });
      await fixture.host.mount();
      const unmount = fixture.host.unmount();
      const terminal = fixture.terminal();
      expect(terminal).toBeDefined();
      const [unmounted, disposed] = await Promise.allSettled([unmount, terminal]);
      expect(unmounted).toEqual({ status: 'fulfilled', value: undefined });
      expect(disposed).toEqual({ status: 'rejected', reason: value });
      if (disposed.status === 'rejected') expect(disposed.reason).toBe(value);
      expect(fixture.calls).toEqual(['begin', 'unmounted', 'beforeDispose', 'afterUnmount']);
      expect(fixture.after.stateReadable).toBe(false);
      expect(fixture.after.completion).toBe(terminal);
      expect(fixture.host.dispose()).toBe(terminal);
    }
  );

  it('completes successful reentrant disposal once and preserves its completion identity', async () => {
    const fixture = createReentrantFixture({ entry: 'begin' });
    await fixture.host.mount();
    const unmount = fixture.host.unmount();
    const terminal = fixture.terminal();
    expect(terminal).toBeDefined();
    await expect(Promise.all([unmount, terminal])).resolves.toEqual([undefined, undefined]);
    expect(fixture.calls).toEqual(['begin', 'unmounted', 'beforeDispose', 'afterUnmount']);
    expect(fixture.after.stateReadable).toBe(false);
    expect(fixture.after.completion).toBe(terminal);
    expect(fixture.host.dispose()).toBe(terminal);
    expect(() => fixture.state().get()).toThrow(/disposed/i);
  });
});

describe('adapter-base: synchronous reentrant terminal completion', () => {
  for (const failureAt of ['beforeDispose', 'afterUnmount'] as const) {
    it.each(failures)(
      `publishes one completion before callbacks when ${failureAt} throws $name`,
      async ({ value }) => {
        const calls: string[] = [];
        const nested: Promise<void>[] = [];
        let host: ReturnType<typeof createAdapterHost>;
        const proto = definePrototype({
          name: 'sprint1-sync-disposal-completion',
          setup(def) {
            def.lifecycle.onBeforeDispose(() => {
              calls.push('beforeDispose');
              nested.push(host.dispose());
              if (failureAt === 'beforeDispose') throw value;
            });
          },
        });
        host = createAdapterHost(
          proto,
          {
            getRawProps: () => ({}),
            schedule: (task) => task(),
            commit: (_children, signal) => signal?.done(),
          },
          {
            afterUnmount() {
              calls.push('afterUnmount');
              nested.push(host.dispose());
              if (failureAt === 'afterUnmount') throw value;
              throw new Error('secondary adapter cleanup failure');
            },
          },
          { initialMount: 'manual' }
        );
        const terminal = host.dispose();
        // Attach every observer before asserting identities, retaining the
        // actual rejection even on the original failing implementation.
        const outcomes = await Promise.allSettled([terminal, ...nested]);
        expect(calls).toEqual(['beforeDispose', 'afterUnmount']);
        expect(nested).toHaveLength(2);
        expect(nested[0]).toBe(terminal);
        expect(nested[1]).toBe(terminal);
        for (const outcome of outcomes) {
          expect(outcome.status).toBe('rejected');
          if (outcome.status === 'rejected') expect(outcome.reason).toBe(value);
        }
        expect(host.dispose()).toBe(terminal);
      }
    );
  }

  it('does not assimilate a cleanup hook returning its own published completion', async () => {
    const calls: string[] = [];
    let nested: Promise<void> | undefined;
    let host: ReturnType<typeof createAdapterHost>;
    const proto = definePrototype({ name: 'sprint1-cleanup-returns-completion', setup() {} });
    host = createAdapterHost(
      proto,
      {
        getRawProps: () => ({}),
        schedule: (task) => task(),
        commit: (_children, signal) => signal?.done(),
      },
      {
        afterUnmount() {
          calls.push('afterUnmount');
          nested = host.dispose();
          return nested;
        },
      },
      { initialMount: 'manual' }
    );
    const terminal = host.dispose();
    expect(calls).toEqual(['afterUnmount']);
    await terminal;
    expect(nested).toBe(terminal);
    expect(host.dispose()).toBe(terminal);
  });
});
