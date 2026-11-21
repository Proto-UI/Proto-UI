// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInThisContext } from 'node:vm';
import {
  installProminentTintPreferenceProbe,
  runProminentTintSyntheticCancel,
  runProminentTintCase,
  awaitProminentTintCheckpoint,
  PROMINENT_TINT_OBSERVATION_PROGRESS,
  type TintRunnerFailure,
} from '../../../../test/fixtures/liquid-prominent-tint-test-harness';

afterEach(() => vi.unstubAllGlobals());

function host(install = installProminentTintPreferenceProbe) {
  // Synchronous dispatch intentionally models listener reentry. Bound native
  // query registration so a regression fails instead of hanging this runner.
  class Target {
    listeners = new Set<() => void>();
    addEventListener(_type: string, listener: () => void) {
      this.listeners.add(listener);
    }
    removeEventListener(_type: string, listener: () => void) {
      this.listeners.delete(listener);
    }
    dispatchEvent() {
      for (const listener of [...this.listeners]) listener();
      return true;
    }
  }
  const real = new Map<string, (Target & { matches: boolean; media: string })[]>();
  let registrations = 0;
  const window = {
    matchMedia: (query: string) => {
      if (++registrations > 16) throw new Error('bounded reentrant registration limit');
      const result = Object.assign(new Target(), {
        media: query,
        matches:
          query.includes('no-preference') ||
          query.includes(': none') ||
          query.includes('resolution'),
      });
      real.set(query, [...(real.get(query) ?? []), result]);
      return result;
    },
    tintUnknownPreference: (_feature: string | null) => {},
  };
  vi.stubGlobal('window', window);
  vi.stubGlobal('EventTarget', Target);
  install();
  return { window, real, registrations: () => registrations };
}

describe('synthetic unknown preference dispatch boundary', () => {
  it('runs after browser-style serialization without any imported closure', () => {
    const { window } = host(() =>
      runInThisContext(`(${installProminentTintPreferenceProbe.toString()})()`)
    );
    const query = window.matchMedia('(prefers-reduced-motion: no-preference)');
    expect(query.matches).toBe(true);
    window.tintUnknownPreference('prefers-reduced-motion');
    expect(query.matches).toBe(false);
    window.tintUnknownPreference(null);
    expect(query.matches).toBe(true);
  });

  it('does not dispatch resolution changes or enter its self-registering listener', () => {
    const { window, registrations } = host();
    const changed = vi.fn();
    const resolutionChanged = () => {
      changed();
      window.matchMedia('(resolution: 1dppx)').addEventListener('change', resolutionChanged);
    };
    resolutionChanged();
    const before = registrations();
    expect(() => window.tintUnknownPreference('prefers-reduced-motion')).not.toThrow();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(registrations()).toBe(before);
  });

  it('snapshots listeners before dispatch even when the changed query registers another query', () => {
    const { window, registrations } = host();
    const changed = vi.fn();
    const watch = () => {
      const query = window.matchMedia('(prefers-reduced-motion: no-preference)');
      query.addEventListener('change', () => {
        changed();
        watch();
      });
    };
    watch();
    expect(() => window.tintUnknownPreference('prefers-reduced-motion')).not.toThrow();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(registrations()).toBe(2);
    window.tintUnknownPreference('prefers-reduced-motion');
    expect(changed).toHaveBeenCalledTimes(1);
    window.tintUnknownPreference(null);
    expect(changed).toHaveBeenCalledTimes(3);
    expect(registrations()).toBe(4);
  });

  it('notifies only queries whose effective value changes, including restoration and feature switches', () => {
    const { window } = host();
    const events = new Map<string, ReturnType<typeof vi.fn>>();
    for (const query of [
      '(prefers-reduced-motion: no-preference)',
      '(prefers-reduced-motion: reduce)',
      '(prefers-contrast: no-preference)',
      '(prefers-color-scheme: dark)',
      '(resolution: 1dppx)',
    ]) {
      const listener = vi.fn();
      window.matchMedia(query).addEventListener('change', listener);
      events.set(query, listener);
    }
    window.tintUnknownPreference('prefers-reduced-motion');
    window.tintUnknownPreference('prefers-reduced-motion');
    window.tintUnknownPreference('prefers-contrast');
    window.tintUnknownPreference(null);
    window.tintUnknownPreference(null);
    expect([...events.values()].map((listener) => listener.mock.calls.length)).toEqual([
      2, 0, 2, 0, 0,
    ]);
  });

  it('continues forwarding native preference changes', () => {
    const { window, real } = host();
    const query = '(prefers-reduced-motion: reduce)';
    const proxy = window.matchMedia(query);
    const changed = vi.fn();
    proxy.addEventListener('change', changed);
    const native = real.get(query)![0];
    native.matches = true;
    native.dispatchEvent();
    expect(proxy.matches).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function caseRun(run: () => Promise<void>, completed = vi.fn(async () => {})) {
  const started = deferred();
  let failure: ((result: TintRunnerFailure) => Promise<void>) | undefined;
  const transitions = {
    running: vi.fn(async () => {}),
    completed,
    failed: vi.fn(async (_error: unknown) => {}),
  };
  const done = runProminentTintCase(
    () => {
      started.resolve();
      return run();
    },
    (callback) => {
      failure = callback;
    },
    transitions
  );
  return {
    done,
    started: started.promise,
    transitions,
    timeout: () => failure?.({ errors: [{ message: 'Test timed out in 120000ms.' }] }),
  };
}

describe('runner timeout reconciliation', () => {
  it('rejects a capture whose case ended while its checkpoint was being persisted', async () => {
    const checkpoint = deferred();
    let running = true;
    const done = awaitProminentTintCheckpoint(
      'last-capture',
      () => checkpoint.promise,
      () => running
    );
    const rejected = expect(done).rejects.toThrow('case ended during checkpoint: last-capture');
    running = false;
    checkpoint.resolve();
    await rejected;
    await expect(
      awaitProminentTintCheckpoint(
        'live-capture',
        async () => {},
        () => true
      )
    ).resolves.toBeUndefined();
  });

  it('never claims a terminal summary when its later write or cleanup times out', async () => {
    const pendingCleanup = deferred();
    let summary: typeof PROMINENT_TINT_OBSERVATION_PROGRESS | undefined;
    const state = caseRun(async () => {
      summary = { ...PROMINENT_TINT_OBSERVATION_PROGRESS };
      await pendingCleanup.promise;
    });
    await state.started;
    await state.timeout();
    pendingCleanup.resolve();
    await state.done;
    expect(summary).toMatchObject({ progress: 'observations-collected', terminal: false });
    expect(summary?.outcomeAuthority).toContain('not a verdict');
    expect(state.transitions.failed).toHaveBeenCalledTimes(1);
    expect(state.transitions.completed).not.toHaveBeenCalled();
  });

  it('does not begin the case body after timeout during its initial checkpoint', async () => {
    const checkpoint = deferred();
    const body = vi.fn(async () => {});
    let failure!: (result: TintRunnerFailure) => Promise<void>;
    const completed = vi.fn(async () => {}),
      failed = vi.fn(async () => {});
    const done = runProminentTintCase(
      body,
      (callback) => {
        failure = callback;
      },
      {
        running: () => checkpoint.promise,
        completed,
        failed,
      }
    );
    await failure({ errors: [{ message: 'Test timed out in 120000ms.' }] });
    checkpoint.resolve();
    await done;
    expect(body).not.toHaveBeenCalled();
    expect(completed).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('records the executed timeout immediately and prevents late completion from becoming passed', async () => {
    const body = deferred();
    const state = caseRun(() => body.promise);
    await state.started;
    await state.timeout();
    expect(state.transitions.failed).toHaveBeenCalledTimes(1);
    expect(String(state.transitions.failed.mock.calls[0][0])).toContain('120000ms');
    body.resolve();
    await state.done;
    expect(state.transitions.completed).not.toHaveBeenCalled();
  });

  it('retains the original failure when the timed-out body rejects later', async () => {
    const body = deferred();
    const state = caseRun(() => body.promise);
    await state.started;
    await state.timeout();
    const done = expect(state.done).rejects.toThrow('late browser close');
    body.reject(new Error('late browser close'));
    await done;
    expect(state.transitions.failed).toHaveBeenCalledTimes(1);
    expect(String(state.transitions.failed.mock.calls[0][0])).toContain('120000ms');
  });

  it('does not let completed bookkeeping hide a runner timeout during checkpoint persistence', async () => {
    const checkpoint = deferred();
    const state = caseRun(
      async () => {},
      vi.fn(() => checkpoint.promise)
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(state.transitions.completed).toHaveBeenCalledTimes(1);
    await state.timeout();
    expect(state.transitions.failed).toHaveBeenCalledTimes(1);
    checkpoint.resolve();
    await state.done;
  });

  it('preserves ordinary success and assertion failure', async () => {
    const success = caseRun(async () => {});
    await success.done;
    expect(success.transitions.completed).toHaveBeenCalledTimes(1);
    expect(success.transitions.failed).not.toHaveBeenCalled();
    const failed = caseRun(async () => {
      throw new Error('original assertion');
    });
    await expect(failed.done).rejects.toThrow('original assertion');
    expect(failed.transitions.failed).toHaveBeenCalledTimes(1);
    await failed.timeout();
    expect(failed.transitions.failed).toHaveBeenCalledTimes(1);
  });
});

/** Deterministic input model, not browser evidence. Synthetic DOM cancellation
 * clears component contact but leaves the native mouse session held. A later
 * mouseup over its down target still emits one click; an outside release does not. */
function syntheticCancelInput() {
  const requests = ['first action', 'second action'];
  const state = { pressed: true, contact: 'held', nativeHeld: true, overTarget: true };
  const events: string[] = [];
  const target = {
    dispatchEvent: vi.fn(async (type: string, init: Record<string, unknown>) => {
      expect(type).toBe('pointercancel');
      expect(init).toEqual({ pointerId: 1, pointerType: 'mouse', button: 0, buttons: 0 });
      state.pressed = false;
      state.contact = 'rest';
      events.push('synthetic-cancel');
    }),
  };
  const mouse = {
    move: vi.fn(async (x: number, y: number) => {
      expect([x, y]).toEqual([0, 0]);
      state.overTarget = false;
      events.push('move-outside');
    }),
    up: vi.fn(async () => {
      if (state.nativeHeld && state.overTarget) requests.push('later native click');
      state.nativeHeld = false;
      events.push('native-release');
    }),
  };
  const assertCancelled = vi.fn(async () => {
    expect(requests).toHaveLength(2);
    expect(state).toMatchObject({ pressed: false, contact: 'rest', nativeHeld: true });
    events.push('assert-cancelled');
  });
  const assertReleasedOutside = vi.fn(async () => {
    expect(requests).toHaveLength(2);
    expect(state.nativeHeld).toBe(false);
    events.push('assert-released-outside');
  });
  return { target, mouse, assertCancelled, assertReleasedOutside, requests, state, events };
}

describe('synthetic cancellation checkpoint and native input cleanup', () => {
  it('asserts unchanged requests immediately after cancel, then moves outside and asserts again after release', async () => {
    const input = syntheticCancelInput();
    await runProminentTintSyntheticCancel(input);
    expect(input.events).toEqual([
      'synthetic-cancel',
      'assert-cancelled',
      'move-outside',
      'native-release',
      'assert-released-outside',
    ]);
    expect(input.assertCancelled).toHaveBeenCalledOnce();
    expect(input.assertReleasedOutside).toHaveBeenCalledOnce();
    expect(input.requests).toHaveLength(2);
  });

  it('retains the discriminating control: synthetic cancel followed by an on-target native release adds a request', async () => {
    const input = syntheticCancelInput();
    await input.target.dispatchEvent('pointercancel', {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 0,
    });
    await input.assertCancelled();
    await input.mouse.up();
    expect(input.requests).toHaveLength(3);
    expect(input.requests[2]).toBe('later native click');
  });

  it('retains an immediate cancellation failure before any native cleanup can mask it', async () => {
    const input = syntheticCancelInput();
    const dispatch = input.target.dispatchEvent;
    input.target.dispatchEvent = vi.fn(async (type, init) => {
      await dispatch(type, init);
      input.requests.push('unexpected cancellation action');
    });
    await expect(runProminentTintSyntheticCancel(input)).rejects.toThrow('length of 2');
    expect(input.mouse.move).not.toHaveBeenCalled();
    expect(input.mouse.up).not.toHaveBeenCalled();
    expect(input.assertReleasedOutside).not.toHaveBeenCalled();
  });

  it('retains a separate failure if outside release unexpectedly creates a request', async () => {
    const input = syntheticCancelInput();
    const release = input.mouse.up;
    input.mouse.up = vi.fn(async () => {
      await release();
      input.requests.push('unexpected outside-release action');
    });
    await expect(runProminentTintSyntheticCancel(input)).rejects.toThrow('length of 2');
    expect(input.assertCancelled).toHaveBeenCalledOnce();
    expect(input.assertReleasedOutside).toHaveBeenCalledOnce();
  });

  it('awaits the immediate checkpoint before moving or releasing the held native input', async () => {
    const input = syntheticCancelInput();
    const checkpoint = deferred(),
      entered = deferred();
    const done = runProminentTintSyntheticCancel({
      ...input,
      assertCancelled: async () => {
        entered.resolve();
        await checkpoint.promise;
        await input.assertCancelled();
      },
    });
    await entered.promise;
    expect(input.mouse.move).not.toHaveBeenCalled();
    expect(input.mouse.up).not.toHaveBeenCalled();
    checkpoint.resolve();
    await done;
    expect(input.assertReleasedOutside).toHaveBeenCalledOnce();
  });
});
