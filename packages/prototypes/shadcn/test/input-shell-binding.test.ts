import type { StateSubscribeCallback } from '@proto.ui/core';
import { describe, it, expect } from 'vitest';
import { bindInputShellControl } from '../src/input-shell/bind-control';
const cleanupFailures: Array<[string, unknown]> = [
  ['undefined', undefined],
  ['null', null],
  ['false', false],
  ['zero', 0],
  ['empty string', ''],
  ['Error', new Error('cleanup')],
];
function fact(initial = false) {
  let value: unknown = initial;
  const listeners = new Set<StateSubscribeCallback<boolean>>();
  return {
    get: () => value as boolean,
    subscribe(fn: StateSubscribeCallback<boolean>) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    set(next: unknown) {
      const prev = value;
      value = next;
      for (const fn of [...listeners])
        fn({ type: 'next', prev: prev as boolean, next: next as boolean });
    },
    count: () => listeners.size,
  };
}
function control() {
  const focusVisible = fact(),
    disabled = fact();
  return { focusVisible, disabled, getExposes: () => ({ focusVisible, disabled }) };
}
function owner() {
  let current = true;
  const callbacks = new Set<() => void>();
  return {
    isCurrent: () => current,
    onDispose(fn: () => void) {
      callbacks.add(fn);
      return () => {
        callbacks.delete(fn);
      };
    },
    destroy() {
      current = false;
      for (const fn of [...callbacks]) fn();
    },
    count: () => callbacks.size,
  };
}
function target() {
  const writes: Array<{ focusVisible: boolean; disabled: boolean }> = [];
  return {
    instance: {},
    setFacts(value: { focusVisible: boolean; disabled: boolean }) {
      writes.push(value);
    },
    writes,
  };
}
function ownerWithCleanupFailure(cleanupError: unknown) {
  const base = owner();
  const onDispose = base.onDispose;
  let attempts = 0;
  return {
    ...base,
    onDispose(fn: () => void) {
      const off = onDispose(fn);
      return () => {
        attempts++;
        off();
        throw cleanupError;
      };
    },
    attempts: () => attempts,
  };
}
function failingUnsubscribe(
  source: { subscribe(listener: StateSubscribeCallback<boolean>): () => void },
  error: unknown
) {
  const subscribe = source.subscribe;
  source.subscribe = (listener: StateSubscribeCallback<boolean>) => {
    const off = subscribe(listener);
    return () => {
      off();
      throw error;
    };
  };
}
describe('single-control input shell composition lifecycle', () => {
  it('retires terminal facts without reading the disconnected source and releases both identities', () => {
    const o = owner(),
      c = control(),
      t = target();
    let terminal = false;
    let notify: StateSubscribeCallback<boolean> = () => {};
    const subscribe = c.disabled.subscribe;
    c.disabled.subscribe = (fn) => {
      notify = fn;
      return subscribe(fn);
    };
    const read = c.getExposes;
    c.getExposes = () => {
      if (terminal) throw new Error('terminal source read');
      return read();
    };
    const binding = bindInputShellControl(o, t, c);
    terminal = true;
    expect(() => notify({ type: 'disconnect', reason: 'unmount' })).not.toThrow();
    expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
    binding.sync();
    expect(t.writes).toHaveLength(1);
    const nextOwner = owner();
    const next = bindInputShellControl(nextOwner, t, control());
    next.dispose();
    terminal = false;
    const sourceOwner = owner();
    bindInputShellControl(sourceOwner, target(), c).dispose();
    expect(sourceOwner.count()).toBe(0);
  });
  it('attempts every unsubscribe and preserves a terminal cleanup failure', () => {
    const o = owner(),
      c = control(),
      t = target();
    const failure = new Error('terminal unsubscribe');
    let notify: StateSubscribeCallback<boolean> = () => {};
    const subscribe = c.disabled.subscribe;
    c.disabled.subscribe = (fn) => {
      notify = fn;
      return subscribe(fn);
    };
    failingUnsubscribe(c.focusVisible, failure);
    bindInputShellControl(o, t, c);
    expect(() => notify({ type: 'disconnect', reason: 'unmount' })).toThrow(failure);
    expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
    expect(t.writes).toHaveLength(1);
  });
  it('does not let an old generation disconnect retire its replacement', () => {
    const o = owner(),
      first = control(),
      second = control(),
      t = target();
    let old: StateSubscribeCallback<boolean> = () => {};
    const subscribe = first.disabled.subscribe;
    first.disabled.subscribe = (fn) => {
      old = fn;
      return subscribe(fn);
    };
    const binding = bindInputShellControl(o, t, first);
    binding.replace(second);
    old({ type: 'disconnect', reason: 'unmount' });
    second.disabled.set(true);
    expect(t.writes.at(-1)?.disabled).toBe(true);
    expect([second.focusVisible.count(), second.disabled.count(), o.count()]).toEqual([1, 1, 1]);
    binding.dispose();
  });
  it('cleans subscriptions returned after synchronous terminal notification before writing', () => {
    const o = owner(),
      c = control(),
      t = target();
    const subscribe = c.focusVisible.subscribe;
    c.focusVisible.subscribe = (fn) => {
      fn({ type: 'disconnect', reason: 'unmount' });
      return subscribe(fn);
    };
    bindInputShellControl(o, t, c);
    expect(t.writes).toHaveLength(0);
    expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
  });

  it('reads current public facts and detaches all subscriptions exactly once', () => {
    const o = owner(),
      c = control(),
      t = target();
    c.disabled.set(true);
    const b = bindInputShellControl(o, t, c);
    expect(t.writes).toEqual([{ focusVisible: false, disabled: true }]);
    c.focusVisible.set(true);
    expect(t.writes.at(-1)).toEqual({ focusVisible: true, disabled: true });
    b.dispose();
    b.dispose();
    o.destroy();
    c.disabled.set(false);
    b.sync();
    expect(t.writes).toHaveLength(2);
    expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
  });
  it('replaces the actual control and never responds to the retired one', () => {
    const o = owner(),
      first = control(),
      next = control(),
      t = target();
    const b = bindInputShellControl(o, t, first);
    next.disabled.set(true);
    b.replace(next);
    const count = t.writes.length;
    first.focusVisible.set(true);
    expect(t.writes).toHaveLength(count);
    expect(t.writes.at(-1)?.disabled).toBe(true);
    expect([first.focusVisible.count(), first.disabled.count()]).toEqual([0, 0]);
    o.destroy();
    expect([next.focusVisible.count(), next.disabled.count()]).toEqual([0, 0]);
  });
  it('rejects duplicate target wrappers and duplicate real control instances', () => {
    const o = owner(),
      c = control(),
      t = target();
    bindInputShellControl(o, t, c);
    expect(() => bindInputShellControl(owner(), { ...t }, control())).toThrow(/Duplicate/);
    expect(() => bindInputShellControl(owner(), target(), c)).toThrow(/Duplicate/);
    o.destroy();
    const o2 = owner();
    bindInputShellControl(o2, t, c);
    o2.destroy();
  });
  it.each(['focusVisible', 'disabled'])(
    'fails closed for missing %s expose and retires a replaced binding',
    (key) => {
      const o = owner(),
        c = control(),
        t = target(),
        b = bindInputShellControl(o, t, c);
      const exposed = c.getExposes();
      delete (exposed as any)[key];
      expect(() => b.replace({ getExposes: () => exposed })).toThrow(/Missing/);
      c.disabled.set(true);
      expect(t.writes).toHaveLength(1);
      expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
    }
  );
  it('rejects invalid runtime facts and cleans up before surfacing the failure', () => {
    const o = owner(),
      c = control(),
      t = target();
    bindInputShellControl(o, t, c);
    expect(() => c.disabled.set('yes')).toThrow(/Invalid/);
    expect(t.writes).toHaveLength(1);
    expect(o.count()).toBe(0);
  });
  it('allows synchronous subscription notifications without writing half-attached facts', () => {
    const o = owner(),
      c = control(),
      t = target();
    for (const f of [c.focusVisible, c.disabled]) {
      const sub = f.subscribe;
      f.subscribe = (fn) => {
        fn({ type: 'next', prev: f.get(), next: f.get() });
        return sub(fn);
      };
    }
    bindInputShellControl(o, t, c);
    expect(t.writes).toHaveLength(1);
    o.destroy();
  });
  it('cleans a subscription returned after synchronous owner destruction', () => {
    const o = owner(),
      c = control(),
      t = target();
    const sub = c.focusVisible.subscribe;
    c.focusVisible.subscribe = (fn) => {
      const off = sub(fn);
      o.destroy();
      return off;
    };
    bindInputShellControl(o, t, c);
    expect(t.writes).toHaveLength(0);
    expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
  });
  it('makes no writes when onDispose retires synchronously', () => {
    const o = owner(),
      c = control(),
      t = target();
    let cleaned = 0;
    o.onDispose = (fn) => {
      fn();
      return () => {
        cleaned++;
      };
    };
    bindInputShellControl(o, t, c);
    expect(cleaned).toBe(1);
    expect(t.writes).toHaveLength(0);
  });
  it('flushes a reentrant factual change instead of losing it', () => {
    const o = owner(),
      c = control(),
      t = target();
    const write = t.setFacts;
    t.setFacts = (value) => {
      write(value);
      if (!value.disabled) c.disabled.set(true);
    };
    bindInputShellControl(o, t, c);
    expect(t.writes).toEqual([
      { focusVisible: false, disabled: false },
      { focusVisible: false, disabled: true },
    ]);
    o.destroy();
  });
  it('checks generation even if a stale subscription callback arrives after replacement', () => {
    const o = owner(),
      c = control(),
      t = target();
    let stale: StateSubscribeCallback<boolean> = () => {};
    const sub = c.focusVisible.subscribe;
    c.focusVisible.subscribe = (fn) => {
      stale = fn;
      return sub(fn);
    };
    const b = bindInputShellControl(o, t, c);
    b.replace(control());
    const before = t.writes.length;
    stale({ type: 'next', prev: false, next: true });
    expect(t.writes).toHaveLength(before);
    o.destroy();
  });
  it('attempts every cleanup and prevents writes even if an unsubscribe throws', () => {
    const o = owner(),
      c = control(),
      t = target();
    const sub = c.focusVisible.subscribe;
    c.focusVisible.subscribe = (fn) => {
      const off = sub(fn);
      return () => {
        off();
        throw new Error('cleanup');
      };
    };
    const b = bindInputShellControl(o, t, c);
    expect(() => b.dispose()).toThrow('cleanup');
    expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
    b.sync();
    expect(t.writes).toHaveLength(1);
  });
  describe.each(['dispose', 'replace'] as const)('%s cleanup failure', (operation) => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['false', false],
      ['zero', 0],
      ['empty string', ''],
      ['Error', new Error('first cleanup')],
    ])('retains the first %s throw while retiring every resource', (_label, primary) => {
      const o = owner(),
        c = control(),
        next = control(),
        t = target();
      const focusSubscribe = c.focusVisible.subscribe;
      const disabledSubscribe = c.disabled.subscribe;
      c.focusVisible.subscribe = (listener) => {
        const off = focusSubscribe(listener);
        return () => {
          off();
          throw primary;
        };
      };
      c.disabled.subscribe = (listener) => {
        const off = disabledSubscribe(listener);
        return () => {
          off();
          throw new Error('secondary cleanup');
        };
      };
      const binding = bindInputShellControl(o, t, c);
      let didThrow = false;
      let observed: unknown;
      try {
        if (operation === 'dispose') binding.dispose();
        else binding.replace(next);
      } catch (cause) {
        didThrow = true;
        observed = cause;
      }
      expect(didThrow).toBe(true);
      expect(observed).toBe(primary);
      expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
      expect([next.focusVisible.count(), next.disabled.count()]).toEqual([0, 0]);
      c.focusVisible.set(true);
      next.disabled.set(true);
      binding.sync();
      binding.dispose();
      expect(t.writes).toEqual([{ focusVisible: false, disabled: false }]);

      c.focusVisible.subscribe = focusSubscribe;
      c.disabled.subscribe = disabledSubscribe;
      const nextOwner = owner();
      const reacquired = bindInputShellControl(nextOwner, t, c);
      expect(t.writes.at(-1)).toEqual({ focusVisible: true, disabled: false });
      expect([c.focusVisible.count(), c.disabled.count(), nextOwner.count()]).toEqual([1, 1, 1]);
      reacquired.dispose();
    });
  });
  describe('owner cleanup failure', () => {
    it.each(cleanupFailures)(
      'surfaces the owner cleanup %s when every control unsubscribe succeeds',
      (_label, ownerError) => {
        const o = ownerWithCleanupFailure(ownerError);
        const c = control();
        const t = target();
        const binding = bindInputShellControl(o, t, c);
        let didThrow = false;
        let observed: unknown;
        try {
          binding.dispose();
        } catch (cause) {
          didThrow = true;
          observed = cause;
        }
        expect(didThrow).toBe(true);
        expect(observed).toBe(ownerError);
        expect(o.attempts()).toBe(1);
        expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
        c.focusVisible.set(true);
        binding.sync();
        expect(t.writes).toEqual([{ focusVisible: false, disabled: false }]);
        expect(() => binding.dispose()).not.toThrow();
        const fresh = owner();
        const reacquired = bindInputShellControl(fresh, t, c);
        expect(t.writes.at(-1)).toEqual({ focusVisible: true, disabled: false });
        expect([c.focusVisible.count(), c.disabled.count(), fresh.count()]).toEqual([1, 1, 1]);
        reacquired.dispose();
      }
    );
    it.each(cleanupFailures)(
      'keeps the first %s control unsubscribe failure when owner cleanup also fails',
      (_label, primary) => {
        const o = ownerWithCleanupFailure(new Error('later owner cleanup'));
        const c = control();
        const t = target();
        failingUnsubscribe(c.focusVisible, primary);
        const binding = bindInputShellControl(o, t, c);
        let didThrow = false;
        let observed: unknown;
        try {
          binding.dispose();
        } catch (cause) {
          didThrow = true;
          observed = cause;
        }
        expect(didThrow).toBe(true);
        expect(observed).toBe(primary);
        expect(o.attempts()).toBe(1);
        expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
        c.focusVisible.set(true);
        binding.sync();
        expect(t.writes).toEqual([{ focusVisible: false, disabled: false }]);
        expect(() => binding.dispose()).not.toThrow();
        const reacquired = bindInputShellControl(owner(), t, control());
        expect(t.writes.at(-1)).toEqual({ focusVisible: false, disabled: false });
        reacquired.dispose();
      }
    );
    it('keeps a later control unsubscribe failure when owner cleanup also fails', () => {
      const primary = new Error('second cleanup');
      const o = ownerWithCleanupFailure(new Error('later owner cleanup'));
      const c = control();
      const t = target();
      failingUnsubscribe(c.disabled, primary);
      const binding = bindInputShellControl(o, t, c);
      let didThrow = false;
      let observed: unknown;
      try {
        binding.dispose();
      } catch (cause) {
        didThrow = true;
        observed = cause;
      }
      expect(didThrow).toBe(true);
      expect(observed).toBe(primary);
      expect(o.attempts()).toBe(1);
      expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
      c.disabled.set(true);
      binding.sync();
      expect(t.writes).toEqual([{ focusVisible: false, disabled: false }]);
      expect(() => binding.dispose()).not.toThrow();
    });
    it('keeps the first control unsubscribe failure when both controls and the owner fail', () => {
      const first = new Error('first cleanup');
      const o = ownerWithCleanupFailure(new Error('later owner cleanup'));
      const c = control();
      const t = target();
      failingUnsubscribe(c.focusVisible, first);
      failingUnsubscribe(c.disabled, new Error('second cleanup'));
      const binding = bindInputShellControl(o, t, c);
      let didThrow = false;
      let observed: unknown;
      try {
        binding.dispose();
      } catch (cause) {
        didThrow = true;
        observed = cause;
      }
      expect(didThrow).toBe(true);
      expect(observed).toBe(first);
      expect(o.attempts()).toBe(1);
      expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
      c.focusVisible.set(true);
      c.disabled.set(true);
      binding.sync();
      expect(t.writes).toEqual([{ focusVisible: false, disabled: false }]);
      expect(() => binding.dispose()).not.toThrow();
    });
    it('keeps the original replacement failure and attaches no new control when owner cleanup also fails', () => {
      const primary = new Error('first cleanup');
      const o = ownerWithCleanupFailure(new Error('later owner cleanup'));
      const c = control();
      const next = control();
      const t = target();
      failingUnsubscribe(c.focusVisible, primary);
      const binding = bindInputShellControl(o, t, c);
      let didThrow = false;
      let observed: unknown;
      try {
        binding.replace(next);
      } catch (cause) {
        didThrow = true;
        observed = cause;
      }
      expect(didThrow).toBe(true);
      expect(observed).toBe(primary);
      expect(o.attempts()).toBe(1);
      expect([c.focusVisible.count(), c.disabled.count(), o.count()]).toEqual([0, 0, 0]);
      expect([next.focusVisible.count(), next.disabled.count()]).toEqual([0, 0]);
      expect(t.writes).toEqual([{ focusVisible: false, disabled: false }]);
      expect(() => binding.dispose()).not.toThrow();
    });
  });
});

it('never publishes an old snapshot when a fact getter replaces its source', () => {
  const o = owner(),
    first = control(),
    next = control(),
    t = target();
  first.focusVisible.set(true);
  const binding = bindInputShellControl(o, t, first);
  const get = first.focusVisible.get;
  let armed = true;
  first.focusVisible.get = () => {
    if (armed) {
      armed = false;
      binding.replace(next);
    }
    return get();
  };
  t.writes.length = 0;
  binding.sync();
  expect(t.writes).toEqual([{ focusVisible: false, disabled: false }]);
  binding.dispose();
});
it('does not reserve a replacement when an old unsubscribe retires the owner', () => {
  const o = owner(),
    first = control(),
    next = control(),
    t = target();
  const subscribe = first.focusVisible.subscribe;
  first.focusVisible.subscribe = (listener) => {
    const off = subscribe(listener);
    return () => {
      off();
      o.destroy();
    };
  };
  const binding = bindInputShellControl(o, t, first);
  expect(() => binding.replace(next)).toThrow(/Retired/);
  const freshOwner = owner();
  const nextBinding = bindInputShellControl(freshOwner, target(), next);
  expect([next.focusVisible.count(), next.disabled.count()]).toEqual([1, 1]);
  nextBinding.dispose();
});
it('rechecks owner retirement after attachment validation getters without reserving a dead source', () => {
  const o = owner(),
    c = control(),
    t = target();
  const get = c.focusVisible.get;
  let reads = 0;
  c.focusVisible.get = () => {
    if (++reads === 2) o.destroy();
    return get();
  };
  bindInputShellControl(o, t, c);
  expect(t.writes).toEqual([]);
  expect([c.focusVisible.count(), c.disabled.count()]).toEqual([0, 0]);
  c.focusVisible.get = get;
  const fresh = owner();
  const binding = bindInputShellControl(fresh, target(), c);
  expect(c.focusVisible.count()).toBe(1);
  binding.dispose();
});
