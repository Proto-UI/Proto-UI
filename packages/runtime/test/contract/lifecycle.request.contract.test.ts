// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createContextKey, definePrototype, delay, type OwnedStateHandle } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeLifecycleEvent } from '../../src';
import { executeRuntimeRequest, type RuntimeRequestScope } from '../../src/instance/request';

const empty = definePrototype({ name: 'request-empty', setup() {} });
const identity = <T>(value: T) => value;

describe('C-LIFECYCLE-REQUEST-0001: private request ownership', () => {
  it('runs setup/created/render/terminal cleanup once, with zero view epochs and no browser globals', async () => {
    expect(typeof window).toBe('undefined');
    const calls: string[] = [];
    const events: RuntimeLifecycleEvent[] = [];
    let state!: OwnedStateHandle<number>;
    let requestScope!: RuntimeRequestScope;
    const proto = definePrototype({
      name: 'request-order',
      setup(def) {
        calls.push('setup');
        def.props.define({ seed: { type: 'number', default: 0 } });
        state = def.state.numberDiscrete('value', 0);
        def.lifecycle.onCreated((run) => {
          calls.push('created');
          state.set(run.props.get().seed);
        });
        def.lifecycle.onMounted(() => calls.push('mounted'));
        def.lifecycle.onUpdated(() => calls.push('updated'));
        def.lifecycle.onUnmounted(() => calls.push('unmounted'));
        def.lifecycle.onBeforeDispose(() => calls.push(`dispose:${state.get()}`));
        return (r) => {
          calls.push(`render:${state.get()}`);
          return r.el('output', String(state.get()));
        };
      },
    });
    const result = await executeRuntimeRequest(proto, {
      props: { seed: 7 },
      onLifecycleEvent: (event) => events.push(event),
      serialize(children, scope) {
        requestScope = scope;
        expect(scope.isCurrent()).toBe(true);
        expect(scope.signal.aborted).toBe(false);
        return JSON.stringify(children);
      },
    });
    expect(result).toContain('7');
    expect(calls).toEqual(['setup', 'created', 'render:7', 'dispose:7']);
    expect(events.some((event) => /^(mount|unmount|update)\./.test(event.type))).toBe(false);
    expect(events.filter((event) => event.type === 'instance.dispose.done')).toHaveLength(1);
    expect(requestScope.isCurrent()).toBe(false);
    expect(requestScope.signal.aborted).toBe(true);
    expect(() => state.get()).toThrow(/disposed/i);
  });

  it('preserves an initial detached ViewIntent without rendering or fabricating a view', async () => {
    const render = vi.fn();
    const proto = definePrototype({
      name: 'request-detached',
      setup(def) {
        def.lifecycle.onCreated((run) => run.lifecycle.setPresent(false));
        return (r) => {
          render();
          return r.el('div', 'must not render');
        };
      },
    });
    expect(await executeRuntimeRequest(proto, { props: {}, serialize: identity })).toEqual([]);
    expect(render).not.toHaveBeenCalled();
  });

  it.each([undefined, null, false, 0, '', new Error('created primary')])(
    'preserves the identical created failure %j after exhaustive failed-created cleanup',
    async (primary) => {
      const calls: string[] = [];
      let state!: OwnedStateHandle<boolean>;
      const proto = definePrototype({
        name: 'request-created-failure',
        setup(def) {
          state = def.state.bool('active', true);
          def.lifecycle.onCreated(() => {
            throw primary;
          });
          def.lifecycle.onCreated(() => calls.push('unreached created'));
          def.lifecycle.onBeforeDispose(() => {
            calls.push('cleanup-one');
            throw new Error('secondary');
          });
          def.lifecycle.onBeforeDispose(() => calls.push('cleanup-two'));
          return (r) => {
            calls.push('unreached render');
            return r.slot();
          };
        },
      });
      await expect(executeRuntimeRequest(proto, { props: {}, serialize: identity })).rejects.toBe(
        primary
      );
      expect(calls).toEqual(['cleanup-one', 'cleanup-two']);
      expect(() => state.get()).toThrow(/disposed/i);
    }
  );

  it.each(['render', 'serialize'] as const)(
    'retires a %s failure and keeps the initiating falsy value',
    async (stage) => {
      const secondary = new Error('secondary disposal');
      const reported: unknown[] = [];
      const cleanup = vi.fn(() => {
        throw secondary;
      });
      const proto = definePrototype({
        name: `request-${stage}-failure`,
        setup(def) {
          def.lifecycle.onBeforeDispose(cleanup);
          return (r) => {
            if (stage === 'render') throw undefined;
            return r.slot();
          };
        },
      });
      await expect(
        executeRuntimeRequest(proto, {
          props: {},
          serialize() {
            return Promise.reject(undefined);
          },
          onCleanupError(error) {
            reported.push(error);
            throw new Error('diagnostic secondary');
          },
        })
      ).rejects.toBeUndefined();
      expect(cleanup).toHaveBeenCalledOnce();
      expect(reported).toEqual([secondary]);
    }
  );

  it('rejects normal completion on a falsy cleanup error and preserves authored fail-fast order', async () => {
    const calls: string[] = [];
    const proto = definePrototype({
      name: 'request-cleanup-failure',
      setup(def) {
        def.lifecycle.onBeforeDispose(() => {
          calls.push('first');
          throw undefined;
        });
        def.lifecycle.onBeforeDispose(() => calls.push('unreached second'));
      },
    });
    await expect(
      executeRuntimeRequest(proto, { props: {}, serialize: identity })
    ).rejects.toBeUndefined();
    expect(calls).toEqual(['first']);
  });

  it.each([null, false, 0, '', new Error('abort primary')])(
    'does not start an already-aborted request (%j)',
    async (reason) => {
      const controller = new AbortController();
      controller.abort(reason);
      const setup = vi.fn();
      await expect(
        executeRuntimeRequest(definePrototype({ name: 'pre-aborted', setup }), {
          props: {},
          signal: controller.signal,
          serialize: identity,
        })
      ).rejects.toBe(reason);
      expect(setup).not.toHaveBeenCalled();
    }
  );

  it('aborts after created before render and releases the newly acquired owner', async () => {
    const controller = new AbortController();
    const cleanup = vi.fn();
    const render = vi.fn();
    const proto = definePrototype({
      name: 'abort-from-created',
      setup(def) {
        def.lifecycle.onCreated(() => controller.abort(false));
        def.lifecycle.onBeforeDispose(cleanup);
        return (r) => {
          render();
          return r.slot();
        };
      },
    });
    await expect(
      executeRuntimeRequest(proto, {
        props: {},
        signal: controller.signal,
        serialize: identity,
      })
    ).rejects.toBe(false);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(render).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)(
    'settles abort without awaiting a serializer and ignores late %s',
    async (outcome) => {
      const controller = new AbortController();
      const work = Promise.withResolvers<string>();
      const cleanup = vi.fn();
      let scope!: RuntimeRequestScope;
      let state!: OwnedStateHandle<boolean>;
      const proto = definePrototype({
        name: 'abort-outstanding-serialization',
        setup(def) {
          state = def.state.bool('alive', true);
          def.lifecycle.onBeforeDispose(cleanup);
        },
      });
      const response = executeRuntimeRequest(proto, {
        props: {},
        signal: controller.signal,
        serialize(_children, request) {
          scope = request;
          return work.promise;
        },
      });
      controller.abort(0);
      await expect(response).rejects.toBe(0);
      expect(scope.isCurrent()).toBe(false);
      expect(scope.signal.aborted).toBe(true);
      expect(cleanup).toHaveBeenCalledOnce();
      expect(() => state.get()).toThrow(/disposed/i);
      if (outcome === 'resolve') work.resolve('stale');
      else work.reject(new Error('late serializer rejection'));
      await Promise.resolve();
      await Promise.resolve();
      expect(cleanup).toHaveBeenCalledOnce();
    }
  );

  it('observes rejected work returned by a serializer that synchronously aborts', async () => {
    const controller = new AbortController();
    await expect(
      executeRuntimeRequest(empty, {
        props: {},
        signal: controller.signal,
        serialize() {
          controller.abort('cancel');
          return Promise.reject('late');
        },
      })
    ).rejects.toBe('cancel');
  });

  it.each([false, true])(
    'observes cleanup-time abort without replacing an earlier failure (primary=%j)',
    async (hasPrimary) => {
      const controller = new AbortController();
      const calls: unknown[] = [];
      const proto = definePrototype({
        name: 'request-cleanup-abort-order',
        setup(def) {
          def.lifecycle.onBeforeDispose(() => {
            calls.push('dispose');
            controller.abort(null);
            throw 'secondary';
          });
        },
      });
      await expect(
        executeRuntimeRequest(proto, {
          props: {},
          signal: controller.signal,
          serialize() {
            if (hasPrimary) throw undefined;
            return 'response';
          },
          onCleanupError(error) {
            calls.push(error);
          },
        })
      ).rejects.toBe(hasPrimary ? undefined : null);
      expect(calls).toEqual(['dispose', 'secondary']);
    }
  );

  it('validates initialization before setup and isolates caller-owned mutable data', async () => {
    const setup = vi.fn();
    let reads = 0;
    const props = Object.defineProperty({}, 'seed', {
      enumerable: true,
      get() {
        reads++;
        return 1;
      },
    });
    await expect(
      executeRuntimeRequest(definePrototype({ name: 'unstarted-invalid-data', setup }), {
        props,
        serialize: identity,
      })
    ).rejects.toThrow(/accessor/);
    expect(reads).toBe(0);
    expect(setup).not.toHaveBeenCalled();
  });

  it('cancels Delay work on completion and makes a hostile late host delivery inert', async () => {
    const timers: { task(): void; cancel: ReturnType<typeof vi.fn> }[] = [];
    const callback = vi.fn();
    const proto = definePrototype({
      name: 'request-owned-delay',
      setup(def) {
        def.lifecycle.onCreated(() => {
          delay(10, callback);
        });
      },
    });
    await executeRuntimeRequest(proto, {
      props: {},
      serialize: identity,
      scheduleDelay(_ms, task) {
        const timer = { task, cancel: vi.fn() };
        timers.push(timer);
        return timer;
      },
    });
    expect(timers).toHaveLength(1);
    expect(timers[0].cancel).toHaveBeenCalledOnce();
    timers[0].task();
    expect(callback).not.toHaveBeenCalled();
  });

  it('turns an asynchronous Delay failure into request failure and terminal disposal', async () => {
    let deliver!: () => void;
    const cleanup = vi.fn();
    const work = Promise.withResolvers<string>();
    const proto = definePrototype({
      name: 'request-delay-error',
      setup(def) {
        def.lifecycle.onCreated(() => {
          delay(0, () => {
            throw false;
          });
        });
        def.lifecycle.onBeforeDispose(cleanup);
      },
    });
    const response = executeRuntimeRequest(proto, {
      props: {},
      serialize: () => work.promise,
      scheduleDelay(_ms, task) {
        deliver = task;
        return { cancel() {} };
      },
    });
    deliver();
    await expect(response).rejects.toBe(false);
    expect(cleanup).toHaveBeenCalledOnce();
    work.resolve('stale');
  });

  it('keeps concurrent request State and Context identities independent across abort', async () => {
    const key = createContextKey<{ value: number }>('request-shared-definition');
    const states: OwnedStateHandle<number>[] = [];
    const contexts: { value: number }[] = [];
    const controller = new AbortController();
    const work = [Promise.withResolvers<string>(), Promise.withResolvers<string>()];
    const proto = definePrototype({
      name: 'request-isolation',
      setup(def) {
        def.props.define({ seed: { type: 'number', default: 0 } });
        const state = def.state.numberDiscrete('seed', 0);
        states.push(state);
        def.context.provide(key, { value: 0 });
        def.context.subscribe(key, () => {});
        def.lifecycle.onCreated((run) => {
          state.set(run.props.get().seed);
          run.context.update(key, { value: state.get() });
        });
        return (r) => {
          const value = r.read.context.read(key);
          contexts.push(value);
          return r.el('output', String(value.value));
        };
      },
    });
    const one = executeRuntimeRequest(proto, {
      props: { seed: 1 },
      signal: controller.signal,
      serialize: () => work[0].promise,
    });
    const two = executeRuntimeRequest(proto, {
      props: { seed: 2 },
      serialize: () => work[1].promise,
    });
    expect(states[0]).not.toBe(states[1]);
    expect(contexts).toEqual([{ value: 1 }, { value: 2 }]);
    expect(contexts[0]).not.toBe(contexts[1]);
    controller.abort('first only');
    await expect(one).rejects.toBe('first only');
    expect(() => states[0].get()).toThrow(/disposed/i);
    expect(states[1].get()).toBe(2);
    expect(contexts[1]).toEqual({ value: 2 });
    work[1].resolve('second response');
    expect(await two).toBe('second response');
    expect(() => states[1].get()).toThrow(/disposed/i);
    work[0].resolve('late first');
  });

  it('diagnoses view operations without a DOM or fallback host', async () => {
    const proto = definePrototype({
      name: 'request-no-view',
      setup(def) {
        def.lifecycle.onCreated((run) => run.lifecycle.captureViewOperation());
      },
    });
    await expect(executeRuntimeRequest(proto, { props: {}, serialize: identity })).rejects.toThrow(
      /lifecycle.view-operation/
    );
  });

  it('distinguishes same-owner rebind from a fresh browser owner using real Runtime sessions', async () => {
    let setups = 0;
    let created = 0;
    let disposed = 0;
    const states: OwnedStateHandle<number>[] = [];
    const proto = definePrototype({
      name: 'request-new-browser-owner',
      setup(def) {
        setups++;
        const state = def.state.numberDiscrete('value', 0);
        states.push(state);
        def.lifecycle.onCreated(() => {
          created++;
          state.set(1);
        });
        def.lifecycle.onBeforeDispose(() => disposed++);
        return (r) => r.el('output', String(state.get()));
      },
    });
    await executeRuntimeRequest(proto, { props: {}, serialize: identity });
    const host = {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      commit(_children: unknown, signal?: { done(): void }) {
        signal?.done();
      },
      schedule(task: () => void) {
        task();
      },
    };
    const browser = createRuntimeSession(proto, host);
    expect(states[0]).not.toBe(states[1]);
    expect(() => states[0].get()).toThrow(/disposed/i);
    await browser.mount();
    browser.invokeInCallbackScope(() => states[1].set(9));
    await browser.unmount();
    await browser.mount();
    expect(states[1].get()).toBe(9);
    expect([setups, created, disposed, browser.mountEpoch]).toEqual([2, 2, 1, 2]);
    await browser.dispose();
    const replacement = createRuntimeSession(proto, host);
    await replacement.mount();
    expect(states[2]).not.toBe(states[1]);
    expect(states[2].get()).toBe(1);
    expect([setups, created, disposed]).toEqual([3, 3, 2]);
    await replacement.dispose();
  });
});
