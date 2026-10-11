import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFieldFocusObservation, recordFieldFocusSample } from './field-focus-observation';

afterEach(() => {
  document.body.replaceChildren();
  delete (window as any).__fieldFocusEvidence;
  vi.restoreAllMocks();
});

describe('Field focus getter diagnostics (synthetic host controls, not native acceptance)', () => {
  it.each([true, false])(
    'returns the unchanged %s result from exactly one getter call',
    async (value) => {
      let now = 10;
      const observation = createFieldFocusObservation(() => now, 500);
      const getter = vi.fn(async (attempt) => {
        expect(attempt).toBe(1);
        now = 15;
        return value;
      });
      expect(await observation.observe(getter)).toBe(value);
      expect(getter).toHaveBeenCalledTimes(1);
      expect(observation.snapshot()).toEqual({
        nodeTimeOrigin: 500,
        observedAt: 15,
        attempts: [{ attempt: 1, startedAt: 10, state: 'resolved', settledAt: 15, value }],
        diagnosticErrors: 0,
      });
    }
  );

  it('freezes pending-at-failure evidence even after a late true result arrives', async () => {
    let now = 10;
    let resolve!: (value: boolean) => void;
    const observation = createFieldFocusObservation(() => now, 500);
    const pending = observation.observe(() => new Promise<boolean>((done) => (resolve = done)));
    now = 1010;
    const atFailure = observation.snapshot();
    now = 1700;
    resolve(true);
    expect(await pending).toBe(true);
    expect(atFailure.attempts).toEqual([{ attempt: 1, startedAt: 10, state: 'pending' }]);
    expect(observation.snapshot().attempts).toEqual([
      { attempt: 1, startedAt: 10, state: 'resolved', settledAt: 1700, value: true },
    ]);
    atFailure.attempts[0].state = 'rejected';
    expect(observation.snapshot().attempts[0].state).toBe('resolved');
  });

  it('retains the original Vitest 1000ms deadline when the first getter is pending', async () => {
    let resolve!: (value: boolean) => void;
    const observation = createFieldFocusObservation();
    const getter = vi.fn(() => new Promise<boolean>((done) => (resolve = done)));
    let failure: unknown;
    try {
      await expect.poll(() => observation.observe(getter)).toBe(true);
    } catch (error) {
      failure = error;
    }
    expect((failure as Error).message).toBe('Matcher did not succeed in 1000ms');
    expect(getter).toHaveBeenCalledTimes(1);
    const atFailure = observation.snapshot();
    expect(atFailure.attempts[0].state).toBe('pending');
    resolve(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(observation.snapshot().attempts[0]).toMatchObject({ state: 'resolved', value: true });
    expect(atFailure.attempts[0].state).toBe('pending');
    expect((failure as Error).message).toBe('Matcher did not succeed in 1000ms');
  });

  it.each(['synchronous', 'asynchronous'])(
    'preserves %s getter error identity without retry',
    async (mode) => {
      const error = new Error('original failure');
      const observation = createFieldFocusObservation();
      const getter = vi.fn(() => {
        if (mode === 'synchronous') throw error;
        return Promise.reject(error);
      });
      await expect(observation.observe(getter)).rejects.toBe(error);
      expect(getter).toHaveBeenCalledTimes(1);
      expect(observation.snapshot().attempts[0]).toMatchObject({ state: 'rejected' });
      expect(observation.snapshot().attempts[0]).not.toHaveProperty('value');
    }
  );

  it('distinguishes explicit subsequent attempts without introducing any of its own', async () => {
    const observation = createFieldFocusObservation();
    const getter = vi.fn(async () => false);
    await observation.observe(getter);
    await observation.observe(getter);
    expect(getter.mock.calls).toEqual([[1], [2]]);
    expect(observation.snapshot().attempts.map((entry) => entry.attempt)).toEqual([1, 2]);
  });

  it.each([true, false])(
    'still invokes the getter once and returns %s when every clock read throws',
    async (value) => {
      const observation = createFieldFocusObservation(() => {
        throw new Error('synthetic diagnostic clock failure');
      }, 500);
      const getter = vi.fn(async () => value);
      expect(await observation.observe(getter)).toBe(value);
      expect(getter).toHaveBeenCalledTimes(1);
      expect(observation.snapshot()).toEqual({
        nodeTimeOrigin: 500,
        observedAt: null,
        attempts: [{ attempt: 1, startedAt: null, settledAt: null, state: 'resolved', value }],
        diagnosticErrors: 3,
      });
    }
  );

  it('preserves a true result when only settlement and snapshot timing fail', async () => {
    let calls = 0;
    const observation = createFieldFocusObservation(() => {
      if (++calls > 1) throw new Error('synthetic late clock failure');
      return 10;
    }, 500);
    const getter = vi.fn(async () => true);
    expect(await observation.observe(getter)).toBe(true);
    expect(getter).toHaveBeenCalledTimes(1);
    expect(observation.snapshot()).toMatchObject({
      observedAt: null,
      attempts: [{ attempt: 1, startedAt: 10, settledAt: null, state: 'resolved', value: true }],
      diagnosticErrors: 2,
    });
  });

  it.each(['synchronous', 'asynchronous'])(
    'keeps the original %s getter error when diagnostic timing also fails',
    async (mode) => {
      const original = new Error('original getter error');
      let calls = 0;
      const observation = createFieldFocusObservation(() => {
        if (++calls > 1) throw new Error('synthetic late clock failure');
        return 10;
      }, 500);
      const getter = vi.fn(() => {
        if (mode === 'synchronous') throw original;
        return Promise.reject(original);
      });
      await expect(observation.observe(getter)).rejects.toBe(original);
      expect(getter).toHaveBeenCalledTimes(1);
      expect(observation.snapshot()).toMatchObject({
        observedAt: null,
        attempts: [{ attempt: 1, startedAt: 10, settledAt: null, state: 'rejected' }],
        diagnosticErrors: 2,
      });
    }
  );

  it('does not throw from a failure-boundary snapshot whose clock is unavailable', async () => {
    let calls = 0;
    const observation = createFieldFocusObservation(() => {
      if (++calls > 2) throw new Error('synthetic snapshot clock failure');
      return calls * 10;
    }, 500);
    await observation.observe(async () => true);
    expect(observation.snapshot()).toEqual({
      nodeTimeOrigin: 500,
      observedAt: null,
      attempts: [{ attempt: 1, startedAt: 10, settledAt: 20, state: 'resolved', value: true }],
      diagnosticErrors: 1,
    });
  });

  it('does not skip the getter if appending a diagnostic attempt fails', async () => {
    const observation = createFieldFocusObservation(() => 10, 500);
    let calls = 0;
    const push = Array.prototype.push;
    let result: Promise<boolean>;
    try {
      Array.prototype.push = () => {
        throw new Error('synthetic recording failure');
      };
      result = observation.observe(async () => {
        calls++;
        return true;
      });
    } finally {
      Array.prototype.push = push;
    }
    expect(await result!).toBe(true);
    expect(calls).toBe(1);
    expect(observation.snapshot()).toMatchObject({ attempts: [], diagnosticErrors: 1 });
  });

  it('returns an explicitly incomplete snapshot if copying diagnostics fails', async () => {
    const observation = createFieldFocusObservation(() => 10, 500);
    await observation.observe(async () => true);
    const map = Array.prototype.map;
    let snapshot: ReturnType<typeof observation.snapshot>;
    try {
      Array.prototype.map = () => {
        throw new Error('synthetic snapshot copy failure');
      };
      snapshot = observation.snapshot();
    } finally {
      Array.prototype.map = map;
    }
    expect(snapshot!).toMatchObject({ attempts: [], diagnosticErrors: 1 });
    expect(observation.snapshot().attempts[0]).toMatchObject({ state: 'resolved', value: true });
  });

  it('records a direct focused editor while leaving focus, value and attributes unchanged', () => {
    const input = document.createElement('input');
    input.dataset.demoRef = 'requiredControl';
    input.value = 'private text must not enter diagnostics';
    document.body.append(input);
    input.focus(); // Explicit synthetic setup, not an action by the observer.
    const markup = input.outerHTML;
    const focus = vi.spyOn(input, 'focus');
    const blur = vi.spyOn(input, 'blur');
    expect(recordFieldFocusSample(input, 1)).toBe(true);
    const [sample] = (window as any).__fieldFocusEvidence;
    expect(sample).toMatchObject({
      attempt: 1,
      value: true,
      connected: true,
      rootKind: 'document',
      rootHost: null,
      target: { tag: 'input', ref: 'requiredControl' },
      documentActive: { tag: 'input', ref: 'requiredControl' },
      rootActive: { tag: 'input', ref: 'requiredControl' },
      activeInOwnRoot: true,
    });
    expect(typeof sample.at).toBe('number');
    expect(typeof sample.pageTimeOrigin).toBe('number');
    expect(JSON.stringify(sample)).not.toContain(input.value);
    expect(document.activeElement).toBe(input);
    expect(input.outerHTML).toBe(markup);
    expect(input.value).toBe('private text must not enter diagnostics');
    expect(focus).not.toHaveBeenCalled();
    expect(blur).not.toHaveBeenCalled();
  });

  it('distinguishes a connected but unfocused target from the focused editor', () => {
    const input = document.createElement('input');
    input.dataset.demoRef = 'requiredControl';
    const other = document.createElement('button');
    other.dataset.demoRef = 'other';
    document.body.append(input, other);
    other.focus();
    expect(recordFieldFocusSample(input, 1)).toBe(false);
    expect((window as any).__fieldFocusEvidence[0]).toMatchObject({
      value: false,
      connected: true,
      rootKind: 'document',
      activeInOwnRoot: false,
      documentActive: { tag: 'button', ref: 'other' },
    });
    expect(document.activeElement).toBe(other);
  });

  it('reports shadow retargeting without substituting a passing own-root predicate', () => {
    const host = document.createElement('test-control');
    host.dataset.demoRef = 'requiredControl';
    const shadow = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    shadow.append(input);
    document.body.append(host);
    input.focus();
    expect(shadow.activeElement).toBe(input);
    expect(document.activeElement).toBe(host);
    expect(recordFieldFocusSample(input, 1)).toBe(false);
    expect((window as any).__fieldFocusEvidence[0]).toMatchObject({
      value: false,
      rootKind: 'shadow',
      rootHost: { tag: 'test-control', ref: 'requiredControl' },
      documentActive: { tag: 'test-control', ref: 'requiredControl' },
      activeInOwnRoot: true,
    });
  });

  it('records a disconnected target without treating the retained reference as active', () => {
    const input = document.createElement('input');
    expect(recordFieldFocusSample(input, 1)).toBe(false);
    expect((window as any).__fieldFocusEvidence[0]).toMatchObject({
      value: false,
      connected: false,
      rootKind: 'other',
      activeInOwnRoot: false,
    });
  });

  it('preserves the original boolean if diagnostic identity sampling throws', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    vi.spyOn(input, 'closest').mockImplementation(() => {
      throw new Error('synthetic diagnostic failure');
    });
    expect(recordFieldFocusSample(input, 7)).toBe(true);
    expect((window as any).__fieldFocusEvidence).toEqual([
      { attempt: 7, value: true, diagnosticError: true },
    ]);
  });

  it('can be serialized as a standalone page callback without an imported closure', () => {
    const callback = new Function(
      `return (${recordFieldFocusSample.toString()})`
    )() as typeof recordFieldFocusSample;
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    expect(callback(input, 3)).toBe(true);
    expect((window as any).__fieldFocusEvidence[0]).toMatchObject({ attempt: 3, value: true });
  });

  it('does not change the result even if the diagnostic sink cannot accept an entry', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    (window as any).__fieldFocusEvidence = Object.freeze([]);
    expect(recordFieldFocusSample(input, 1)).toBe(true);
    expect(document.activeElement).toBe(input);
  });
});
