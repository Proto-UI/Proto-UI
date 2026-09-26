import { describe, expect, it } from 'vitest';
import { delay, type DelayTask, type OwnedStateHandle, type Prototype } from '@proto.ui/core';
import { createRuntimeSession, executeWithHost, type RuntimeHost } from '../../src';

type ScheduledDelay = {
  durationMs: number;
  task: () => void;
  cancelled: boolean;
};

function createDelayHost(prototypeName: string): RuntimeHost<any> & {
  delays: ScheduledDelay[];
  flushDelay(index?: number): void;
  flushAllDelays(): void;
} {
  const delays: ScheduledDelay[] = [];

  return {
    prototypeName,
    delays,
    getRawProps() {
      return {};
    },
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    scheduleDelay(durationMs, task) {
      const rec: ScheduledDelay = { durationMs, task, cancelled: false };
      delays.push(rec);
      return {
        cancel() {
          rec.cancelled = true;
        },
      };
    },
    flushDelay(index = 0) {
      const rec = delays[index];
      if (rec) rec.task();
    },
    flushAllDelays() {
      for (const rec of delays.slice()) {
        rec.task();
      }
    },
  };
}

describe('runtime contract: core delay primitive (v0)', () => {
  it('forces failed-creation teardown when disposing diagnostics throw synchronously', () => {
    const host = createDelayHost('x-delay-failed-creation-diagnostic');
    const creationError = new Error('created failed');
    let state!: OwnedStateHandle<boolean>;
    host.onLifecycleEvent = (event) => {
      if (event.type === 'instance.phase' && event.phase === 'disposing') {
        throw new Error('disposing diagnostic failed');
      }
    };
    const proto: Prototype = {
      name: host.prototypeName,
      setup(def) {
        state = def.state.bool('open', false);
        def.lifecycle.onCreated(() => {
          delay(0, () => undefined);
          throw creationError;
        });
      },
    };

    expect(() => createRuntimeSession(proto, host)).toThrow(creationError);
    expect(host.delays.map((task) => task.cancelled)).toEqual([true]);
    expect(() => state.get()).toThrow(/disposed/i);
  });

  it.each([false, true])(
    'SHADOW-R3: cancels failed creation work and disposes once (cleanup throws: %s)',
    async (cleanupThrows) => {
      // C-DELAY-0001-G/H and C-LIFECYCLE-0002-G/0007-A:
      // creation cannot hand a failed generation back to its lifecycle owner.
      const host = createDelayHost('x-delay-failed-creation');
      const creationError = new Error('created failed');
      const cleanupError = new Error('cleanup failed');
      const callbacks: string[] = [];
      const cleanupValues: boolean[] = [];
      const states: OwnedStateHandle<boolean>[] = [];
      let generation = 0;
      let commits = 0;
      host.commit = (_children, signal) => {
        commits++;
        signal?.done();
      };
      const proto: Prototype = {
        name: host.prototypeName,
        setup(def) {
          const current = ++generation;
          const state = def.state.bool('open', false);
          states.push(state);
          def.lifecycle.onCreated(() => {
            callbacks.push(`created:${current}`);
            delay(0, () => callbacks.push(`delay:${current}:first`));
            delay(10, () => callbacks.push(`delay:${current}:second`));
            if (current === 1) throw creationError;
          });
          def.lifecycle.onBeforeDispose(() => {
            callbacks.push(`disposed:${current}`);
            cleanupValues.push(state.get());
            if (current === 1 && cleanupThrows) throw cleanupError;
          });
          return (r) => r.el('div', 'ok');
        },
      };

      let thrown: unknown;
      try {
        createRuntimeSession(proto, host);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBe(creationError);
      expect(host.delays.map((rec) => rec.cancelled)).toEqual([true, true]);
      expect(callbacks).toEqual(['created:1', 'disposed:1']);
      expect(cleanupValues).toEqual([false]);
      expect(() => states[0].get()).toThrow(/disposed/i);
      expect(commits).toBe(0);

      const next = createRuntimeSession(proto, host);
      try {
        await next.mount();
        // Deliberately invoke even canceled host items, as an already queued
        // scheduler completion may race cancellation after a reconnect.
        host.flushAllDelays();
        expect(callbacks).toEqual([
          'created:1',
          'disposed:1',
          'created:2',
          'delay:2:first',
          'delay:2:second',
        ]);
        expect(next.instancePhase).toBe('alive');
        expect(states[1].get()).toBe(false);
      } finally {
        await next.dispose();
      }
      await next.dispose();
      host.flushAllDelays();
      expect(callbacks.filter((call) => call.startsWith('disposed:'))).toEqual([
        'disposed:1',
        'disposed:2',
      ]);
      expect(callbacks.filter((call) => call.startsWith('delay:'))).toHaveLength(2);
      expect(cleanupValues).toEqual([false, false]);
    }
  );

  it('is runtime-only and exported directly from core', () => {
    expect(() => delay(0, () => undefined)).toThrow(/runtime-only/i);

    const host = createDelayHost('x-delay-runtime-only');
    const calls: string[] = [];

    const P: Prototype = {
      name: 'x-delay-runtime-only',
      setup() {
        expect(() => delay(0, () => undefined)).toThrow(/runtime-only/i);

        return (r) => [r.el('div', 'ok')];
      },
    };

    executeWithHost(P, host);
    host.flushAllDelays();
    expect(calls).toEqual([]);
  });

  it('validates duration as non-negative finite milliseconds', () => {
    const host = createDelayHost('x-delay-duration-validation');

    const P: Prototype = {
      name: 'x-delay-duration-validation',
      setup(def) {
        def.lifecycle.onCreated(() => {
          expect(() => delay(-1, () => undefined)).toThrow(/durationMs/i);
          expect(() => delay(Number.NaN, () => undefined)).toThrow(/durationMs/i);
          expect(() => delay(Number.POSITIVE_INFINITY, () => undefined)).toThrow(/durationMs/i);
          expect(() => delay(0, () => undefined)).not.toThrow();
        });

        return (r) => [r.el('div', 'ok')];
      },
    };

    executeWithHost(P, host);
    expect(host.delays).toHaveLength(1);
    expect(host.delays[0].durationMs).toBe(0);
  });

  it('requires a host delay scheduler when delay is used', () => {
    const host: RuntimeHost<any> = {
      prototypeName: 'x-delay-missing-scheduler',
      getRawProps() {
        return {};
      },
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
    };

    const P: Prototype = {
      name: 'x-delay-missing-scheduler',
      setup(def) {
        def.lifecycle.onCreated(() => {
          delay(0, () => undefined);
        });

        return (r) => [r.el('div', 'ok')];
      },
    };

    expect(() => executeWithHost(P, host)).toThrow(/scheduleDelay/i);
  });

  it('records the requested minimum duration and never runs zero delay synchronously', () => {
    const host = createDelayHost('x-delay-zero-async');
    const calls: string[] = [];

    const P: Prototype = {
      name: 'x-delay-zero-async',
      setup(def) {
        def.lifecycle.onCreated(() => {
          calls.push('created:start');
          delay(0, () => calls.push('delay:0'));
          delay(25, () => calls.push('delay:25'));
          calls.push('created:end');
        });

        return (r) => [r.el('div', 'ok')];
      },
    };

    executeWithHost(P, host);

    expect(calls).toEqual(['created:start', 'created:end']);
    expect(host.delays.map((rec) => rec.durationMs)).toEqual([0, 25]);

    host.flushDelay(0);
    expect(calls).toEqual(['created:start', 'created:end', 'delay:0']);

    host.flushDelay(1);
    expect(calls).toEqual(['created:start', 'created:end', 'delay:0', 'delay:25']);
  });

  it('returns an idempotent cancel task and suppresses queued host callbacks after cancel', () => {
    const host = createDelayHost('x-delay-cancel');
    const calls: string[] = [];
    let task!: DelayTask;

    const P: Prototype = {
      name: 'x-delay-cancel',
      setup(def) {
        def.lifecycle.onCreated(() => {
          task = delay(10, () => calls.push('delay'));
          task.cancel();
          task.cancel();
        });

        return (r) => [r.el('div', 'ok')];
      },
    };

    executeWithHost(P, host);

    expect(host.delays).toHaveLength(1);
    expect(host.delays[0].cancelled).toBe(true);

    host.flushAllDelays();
    expect(calls).toEqual([]);
  });

  it('invalidates pending delay callbacks when the instance unmounts', async () => {
    const host = createDelayHost('x-delay-unmount');
    const calls: string[] = [];

    const P: Prototype = {
      name: 'x-delay-unmount',
      setup(def) {
        def.lifecycle.onCreated(() => {
          delay(10, () => calls.push('delay'));
        });
        def.lifecycle.onUnmounted(() => {
          calls.push('unmounted');
        });

        return (r) => [r.el('div', 'ok')];
      },
    };

    const result = executeWithHost(P, host);
    expect(host.delays).toHaveLength(1);

    await result.invokeUnmounted();
    expect(calls).toEqual(['unmounted']);
    expect(host.delays[0].cancelled).toBe(true);

    host.flushAllDelays();
    expect(calls).toEqual(['unmounted']);
  });

  it('runs delay callbacks inside runtime callback context without setup authority', () => {
    const host = createDelayHost('x-delay-callback-context');
    let open!: OwnedStateHandle<boolean>;

    const P: Prototype = {
      name: 'x-delay-callback-context',
      setup(def) {
        open = def.state.bool('open', false);
        def.lifecycle.onCreated(() => {
          delay(0, () => {
            expect(() => open.set(true)).not.toThrow();
            expect(() => open.setDefault(false)).toThrow(/exec-phase violation/i);
          });
        });

        return (r) => [r.el('div', 'ok')];
      },
    };

    executeWithHost(P, host);

    expect(() => host.flushAllDelays()).not.toThrow();
    expect(open.get()).toBe(true);
  });
});
