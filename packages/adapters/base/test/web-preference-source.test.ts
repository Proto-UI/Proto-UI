import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultWebMetaGetter,
  createDefaultWebPreferenceSource,
  WEB_PREFERENCE_QUERIES,
} from '../src';
const KEY = 'preference.reducedTransparency';
const cleanups: Array<() => void> = [];
function host() {
  const values = new Map<string, boolean>();
  const media = new Map<
    string,
    {
      matches: boolean;
      callbacks: Set<() => void>;
      history: Array<() => void>;
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
    }
  >();
  const view = {
    matchMedia: vi.fn((query: string) => {
      if (!media.has(query)) {
        const callbacks = new Set<() => void>();
        const history: Array<() => void> = [];
        media.set(query, {
          get matches() {
            return values.get(query) ?? false;
          },
          callbacks,
          history,
          addEventListener: vi.fn((_event, fn) => {
            callbacks.add(fn);
            history.push(fn);
          }),
          removeEventListener: vi.fn((_event, fn) => {
            callbacks.delete(fn);
          }),
        });
      }
      return media.get(query)!;
    }),
  };
  const doc = { defaultView: view } as unknown as Document;
  return {
    doc,
    view,
    media,
    set(feature: string, value: string | undefined) {
      for (const [key, entry] of media) {
        if (!key.startsWith(`(${feature}:`)) continue;
        values.set(key, key === `(${feature}: ${value})`);
        for (const fn of entry.callbacks) fn();
      }
    },
    initial(feature: string, value: string) {
      values.set(`(${feature}: ${value})`, true);
    },
    count() {
      return [...media.values()].reduce((n, entry) => n + entry.callbacks.size, 0);
    },
  };
}
function bind(
  h: ReturnType<typeof host>,
  keys: Array<keyof typeof WEB_PREFERENCE_QUERIES> = [KEY],
  listener = vi.fn()
) {
  const getter = createDefaultWebMetaGetter(h.doc);
  const source = createDefaultWebPreferenceSource(getter, h.doc)!;
  const off = source.subscribe(keys, listener);
  cleanups.push(off);
  return { getter, source, listener, off };
}
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('bounded Web preference source', () => {
  it.each(Object.entries(WEB_PREFERENCE_QUERIES))(
    'requires an explicit matching alternative for %s',
    (key, [feature, values]) => {
      const h = host();
      const f = bind(h, [key as keyof typeof WEB_PREFERENCE_QUERIES]);
      expect(f.getter(key)).toBe('unknown');
      for (const value of values) {
        h.set(feature, value);
        expect(f.getter(key)).toBe(value);
      }
      h.set(feature, undefined);
      expect(f.getter(key)).toBe('unknown');
    }
  );
  it('is lazy, shares per-query resources and isolates disposer identities', () => {
    const h = host();
    const getter = createDefaultWebMetaGetter(h.doc);
    const source = createDefaultWebPreferenceSource(getter, h.doc)!;
    expect(source.getter).toBe(getter);
    expect(h.view.matchMedia).not.toHaveBeenCalled();
    const listener = vi.fn();
    const first = bind(h, [KEY], listener);
    const second = bind(h, [KEY], listener);
    expect(h.count()).toBe(2);
    expect(listener).not.toHaveBeenCalled();
    expect([...h.media.values()].every((m) => m.addEventListener.mock.calls.length === 1)).toBe(
      true
    );
    first.off();
    first.off();
    expect(h.count()).toBe(2);
    second.off();
    expect(h.count()).toBe(0);
  });
  it('notifies only changed consumed keys and coalesces final effective snapshots', async () => {
    const h = host();
    h.initial('prefers-reduced-transparency', 'no-preference');
    const a = bind(h);
    const b = bind(h, ['preference.contrast']);
    h.set('prefers-reduced-transparency', 'reduce');
    h.set('prefers-reduced-transparency', 'no-preference');
    await Promise.resolve();
    expect(a.listener).not.toHaveBeenCalled();
    h.set('prefers-reduced-transparency', 'reduce');
    h.set('prefers-reduced-transparency', 'reduce');
    await Promise.resolve();
    expect(a.listener).toHaveBeenCalledTimes(1);
    expect(b.listener).not.toHaveBeenCalled();
    h.set('prefers-contrast', 'more');
    await Promise.resolve();
    expect(b.listener).toHaveBeenCalledTimes(1);
  });
  it('does not cross Document realms and ignores old generation callbacks after reconnect', async () => {
    const h = host();
    const other = host();
    const a = bind(h);
    const b = bind(other);
    const old = [...h.media.values()][0].history[0];
    h.set('prefers-reduced-transparency', 'reduce');
    a.off();
    const c = bind(h);
    old();
    await Promise.resolve();
    expect(a.listener).not.toHaveBeenCalled();
    expect(b.listener).not.toHaveBeenCalled();
    expect(c.listener).not.toHaveBeenCalled();
    h.set('prefers-reduced-transparency', 'no-preference');
    await Promise.resolve();
    expect(c.listener).toHaveBeenCalledTimes(1);
    expect(b.getter(KEY)).toBe('unknown');
  });
  it('does not deliver to released listeners and does not starve peers after a listener throws', () => {
    const jobs: Array<() => void> = [];
    vi.stubGlobal('queueMicrotask', (fn: () => void) => jobs.push(fn));
    const h = host();
    const error = new Error('consumer error');
    const a = bind(
      h,
      [KEY],
      vi.fn(() => {
        throw error;
      })
    );
    const b = bind(h);
    h.set('prefers-reduced-transparency', 'reduce');
    jobs.shift()!();
    expect(a.listener).toHaveBeenCalledTimes(1);
    expect(b.listener).toHaveBeenCalledTimes(1);
    expect(jobs.shift()).toThrow(error);
    h.set('prefers-reduced-transparency', 'no-preference');
    a.off();
    b.off();
    jobs.shift()!();
    expect(b.listener).toHaveBeenCalledTimes(1);
  });
  it('uses unknown without APIs or usable event listeners', () => {
    const missing = { defaultView: null } as Document;
    const getter = createDefaultWebMetaGetter(missing);
    const source = createDefaultWebPreferenceSource(getter, missing)!;
    const off = source.subscribe([KEY], vi.fn());
    cleanups.push(off);
    expect(getter(KEY)).toBe('unknown');
    const h = host();
    h.initial('prefers-reduced-transparency', 'no-preference');
    h.view.matchMedia('(prefers-reduced-transparency: no-preference)').addEventListener =
      undefined as any;
    const f = bind(h);
    expect(f.getter(KEY)).toBe('unknown');
    expect(h.count()).toBe(0);
  });
});
