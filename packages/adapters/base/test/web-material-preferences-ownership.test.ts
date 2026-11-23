import { describe, expect, it, vi } from 'vitest';
import { createWebMaterialPreferences } from '../src/material/preferences';

// Fault-injected MQL ownership evidence. The actual preference provider executes;
// the host API failures and event dispatch do not claim native browser behavior.
function fixture() {
  const controls = {
    failAdd: -1,
    failAfterAdd: false,
    failRemove: -1,
    addError: new Error('media listener registration failed'),
    removeError: new Error('media listener removal failed'),
  };
  const queries: Array<{
    listeners: Set<() => void>;
    add: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }> = [];
  const preferences = createWebMaterialPreferences({
    matchMedia() {
      const index = queries.length;
      const listeners = new Set<() => void>();
      const add = vi.fn((_event: string, listener: () => void) => {
        if (controls.failAdd === index && !controls.failAfterAdd) throw controls.addError;
        listeners.add(listener);
        if (controls.failAdd === index) throw controls.addError;
      });
      const remove = vi.fn((_event: string, listener: () => void) => {
        if (controls.failRemove === index) throw controls.removeError;
        listeners.delete(listener);
      });
      queries.push({ listeners, add, remove });
      return { matches: false, addEventListener: add, removeEventListener: remove };
    },
  } as unknown as Window);
  return {
    controls,
    preferences,
    queries,
    count: () => queries.reduce((sum, query) => sum + query.listeners.size, 0),
    emit() {
      for (const query of queries) for (const listener of [...query.listeners]) listener();
    },
  };
}

describe('material preference subscriptions retire as one owner', () => {
  it.each([false, true])(
    'rolls back a partial registration (host added before throw: %s)',
    (after) => {
      const f = fixture();
      f.controls.failAdd = 3;
      f.controls.failAfterAdd = after;
      const listener = vi.fn();
      expect(() => f.preferences.subscribe(listener)).toThrow(f.controls.addError);
      expect(f.count()).toBe(0);
      expect(f.queries.map((query) => query.remove.mock.calls.length)).toEqual([
        1, 1, 1, 1, 0, 0, 0, 0, 0, 0,
      ]);
      f.emit();
      expect(listener).not.toHaveBeenCalled();
      f.controls.failAdd = -1;
      const dispose = f.preferences.subscribe(listener);
      expect(f.count()).toBe(10);
      dispose();
      expect(f.count()).toBe(0);
    }
  );

  it('keeps the original subscription error and retires callbacks despite failed rollback', () => {
    const f = fixture();
    f.controls.failAdd = 4;
    f.controls.failRemove = 1;
    const listener = vi.fn();
    expect(() => f.preferences.subscribe(listener)).toThrow(f.controls.addError);
    // The failing host retains one inert listener; every other removal was attempted.
    expect(f.count()).toBe(1);
    expect(f.queries.slice(0, 5).every((query) => query.remove.mock.calls.length === 1)).toBe(true);
    f.emit();
    expect(listener).not.toHaveBeenCalled();
  });

  it('retires every callback before reporting an unsubscribe failure', () => {
    const f = fixture();
    const listener = vi.fn();
    const dispose = f.preferences.subscribe(listener);
    f.controls.failRemove = 2;
    expect(dispose).toThrow(f.controls.removeError);
    expect(f.count()).toBe(1);
    expect(f.queries.every((query) => query.remove.mock.calls.length === 1)).toBe(true);
    f.emit();
    expect(listener).not.toHaveBeenCalled();
    expect(dispose).not.toThrow();
    expect(f.queries.every((query) => query.remove.mock.calls.length === 1)).toBe(true);
  });

  it('keeps two subscriptions independent when they share the same callback', () => {
    const f = fixture();
    const listener = vi.fn();
    const first = f.preferences.subscribe(listener);
    const second = f.preferences.subscribe(listener);
    expect(f.count()).toBe(20);
    first();
    expect(f.count()).toBe(10);
    f.emit();
    expect(listener).toHaveBeenCalledTimes(10);
    second();
    expect(f.count()).toBe(0);
  });
});
