import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultWebColorSchemeSource, createDefaultWebMetaGetter } from '../src';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const cleanups: (() => void)[] = [];

function createHost() {
  let dark = false;
  const mediaListeners = new Set<() => void>();
  const media = {
    get matches() {
      return dark;
    },
    addEventListener: vi.fn((_type: string, listener: () => void) => mediaListeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) =>
      mediaListeners.delete(listener)
    ),
  };
  const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue(media as any);
  const observers: {
    notify: () => void;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const MutationObserver = vi.fn(function (callback: () => void) {
    const observer = { notify: callback, observe: vi.fn(), disconnect: vi.fn() };
    observers.push(observer);
    return observer;
  });
  vi.stubGlobal('MutationObserver', MutationObserver);

  return {
    media,
    mediaListeners,
    matchMedia,
    MutationObserver,
    observers,
    mutate() {
      observers.at(-1)!.notify();
    },
    setDark(value: boolean) {
      dark = value;
      for (const listener of mediaListeners) listener();
    },
  };
}

function subscribe(invalidate: () => void = vi.fn()) {
  const getter = createDefaultWebMetaGetter();
  const source = createDefaultWebColorSchemeSource(getter)!;
  const off = source.subscribe(invalidate);
  cleanups.push(off);
  return { source, getter, invalidate, off };
}

afterEach(() => {
  for (const off of cleanups.splice(0)) off();
  document.documentElement.className = '';
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('default Web color scheme source', () => {
  it('pairs exact readers and shares lazy observer/media resources across subscribers', () => {
    const host = createHost();
    const getter = createDefaultWebMetaGetter();
    const source = createDefaultWebColorSchemeSource(getter)!;
    expect(source.getter).toBe(getter);
    expect(host.MutationObserver).not.toHaveBeenCalled();
    expect(host.matchMedia).not.toHaveBeenCalled();
    expect(host.media.addEventListener).not.toHaveBeenCalled();

    const first = subscribe();
    const second = subscribe();
    expect(first.getter).not.toBe(second.getter);
    expect(first.invalidate).not.toHaveBeenCalled();
    expect(second.invalidate).not.toHaveBeenCalled();
    expect(host.MutationObserver).toHaveBeenCalledTimes(1);
    expect(host.observers[0].observe).toHaveBeenCalledWith(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    expect(host.media.addEventListener).toHaveBeenCalledTimes(1);
    expect(host.matchMedia.mock.calls.every(([query]) => query === DARK_MEDIA_QUERY)).toBe(true);

    first.off();
    first.off();
    expect(host.observers[0].disconnect).not.toHaveBeenCalled();
    second.off();
    expect(host.observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(host.media.removeEventListener).toHaveBeenCalledTimes(1);
    expect(host.mediaListeners.size).toBe(0);
  });

  it('preserves root dark-first priority and observes system fallback after marker removal', async () => {
    const host = createHost();
    const { getter, invalidate } = subscribe();
    host.setDark(true);
    await Promise.resolve();
    expect(getter('colorScheme')).toBe('dark');
    expect(invalidate).toHaveBeenCalledTimes(1);

    document.documentElement.dataset.theme = 'light';
    host.mutate();
    await Promise.resolve();
    expect(getter('colorScheme')).toBe('light');
    expect(invalidate).toHaveBeenCalledTimes(2);
    host.setDark(false);
    host.setDark(true);
    await Promise.resolve();
    expect(invalidate).toHaveBeenCalledTimes(2);

    document.documentElement.classList.add('dark');
    host.mutate();
    await Promise.resolve();
    expect(getter('colorScheme')).toBe('dark');
    expect(invalidate).toHaveBeenCalledTimes(3);
    document.documentElement.className = 'light';
    document.documentElement.dataset.theme = 'dark';
    host.mutate();
    await Promise.resolve();
    expect(getter('colorScheme')).toBe('dark');
    expect(invalidate).toHaveBeenCalledTimes(3);

    host.setDark(false);
    await Promise.resolve();
    expect(invalidate).toHaveBeenCalledTimes(3);
    document.documentElement.className = '';
    delete document.documentElement.dataset.theme;
    host.mutate();
    await Promise.resolve();
    expect(getter('colorScheme')).toBe('light');
    expect(invalidate).toHaveBeenCalledTimes(4);
  });

  it('notifies each active subscription once for the final effective value of a batch', async () => {
    const host = createHost();
    const first = subscribe();
    const second = subscribe();
    document.documentElement.className = 'dark';
    host.mutate();
    document.documentElement.dataset.theme = 'dark';
    host.mutate();
    host.setDark(true);
    expect(first.invalidate).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(first.invalidate).toHaveBeenCalledTimes(1);
    expect(second.invalidate).toHaveBeenCalledTimes(1);

    document.documentElement.className = 'light';
    document.documentElement.dataset.theme = 'light';
    host.mutate();
    document.documentElement.className = 'dark unrelated';
    host.mutate();
    await Promise.resolve();
    expect(first.invalidate).toHaveBeenCalledTimes(1);
    document.documentElement.classList.add('unrelated-two');
    host.mutate();
    await Promise.resolve();
    expect(first.invalidate).toHaveBeenCalledTimes(1);

    first.off();
    document.documentElement.className = 'light';
    host.mutate();
    await Promise.resolve();
    expect(first.invalidate).toHaveBeenCalledTimes(1);
    expect(second.invalidate).toHaveBeenCalledTimes(2);
  });

  it('continues notifying active subscribers while surfacing each callback failure', () => {
    const host = createHost();
    const microtasks: (() => void)[] = [];
    vi.stubGlobal('queueMicrotask', (callback: () => void) => microtasks.push(callback));
    const firstError = new Error('first consumer failed');
    const secondError = new Error('second consumer failed');
    subscribe(() => {
      throw firstError;
    });
    subscribe(() => {
      throw secondError;
    });
    const healthy = subscribe();

    for (const dark of [true, false]) {
      host.setDark(dark);
      const reported: unknown[] = [];
      while (microtasks.length) {
        try {
          microtasks.shift()!();
        } catch (error) {
          reported.push(error);
        }
      }
      expect(healthy.invalidate).toHaveBeenCalledTimes(dark ? 1 : 2);
      expect(reported).toEqual([firstError, secondError]);
    }
  });

  it('invalidates queued and late callbacks after final release and reconnects freshly', async () => {
    const host = createHost();
    const first = subscribe();
    const oldObserver = host.observers[0];
    const oldMediaListener = [...host.mediaListeners][0];
    host.setDark(true);
    first.off();
    const second = subscribe();
    expect(second.getter('colorScheme')).toBe('dark');
    expect(second.invalidate).not.toHaveBeenCalled();
    oldObserver.notify();
    oldMediaListener();
    await Promise.resolve();
    expect(first.invalidate).not.toHaveBeenCalled();
    expect(second.invalidate).not.toHaveBeenCalled();
    expect(host.MutationObserver).toHaveBeenCalledTimes(2);
    expect(host.mediaListeners.size).toBe(1);

    host.setDark(false);
    await Promise.resolve();
    expect(first.invalidate).not.toHaveBeenCalled();
    expect(second.invalidate).toHaveBeenCalledTimes(1);
  });

  it('keeps independent leases when the same callback subscribes twice', async () => {
    const host = createHost();
    const invalidate = vi.fn();
    const first = subscribe(invalidate);
    subscribe(invalidate);
    first.off();
    host.setDark(true);
    await Promise.resolve();
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(host.observers[0].disconnect).not.toHaveBeenCalled();
  });

  it('still observes root markers when matchMedia is unavailable', async () => {
    const host = createHost();
    vi.stubGlobal('window', { matchMedia: undefined });
    const { getter, invalidate } = subscribe();
    expect(getter('colorScheme')).toBe('light');
    expect(host.media.addEventListener).not.toHaveBeenCalled();
    document.documentElement.dataset.theme = 'dark';
    host.mutate();
    await Promise.resolve();
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(getter('colorScheme')).toBe('dark');
    delete document.documentElement.dataset.theme;
    host.mutate();
    await Promise.resolve();
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(getter('colorScheme')).toBe('light');
  });

  it('does not provide a source without a document or MutationObserver', () => {
    const getter = createDefaultWebMetaGetter();
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('window', undefined);
    expect(createDefaultWebColorSchemeSource(getter)).toBeUndefined();
    expect(getter('colorScheme')).toBe('light');
    vi.unstubAllGlobals();
    vi.stubGlobal('MutationObserver', undefined);
    expect(createDefaultWebColorSchemeSource(getter)).toBeUndefined();
  });
});
