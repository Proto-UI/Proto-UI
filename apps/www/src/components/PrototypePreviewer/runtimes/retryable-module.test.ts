import { describe, expect, it, vi } from 'vitest';
import { retryableModule } from './retryable-module';

function cachedFailure() {
  const requests: string[] = [];
  const moduleMap = new Map<string, Promise<{ value: string }>>();
  const canonical = new URL('/assets/react-runtime.js', location.href).href;
  const failed = new Error(`Failed to fetch dynamically imported module: ${canonical}`);
  const acquire = (url: string) => {
    let pending = moduleMap.get(url);
    if (!pending) {
      requests.push(url);
      pending = url === canonical ? Promise.reject(failed) : Promise.resolve({ value: url });
      moduleMap.set(url, pending);
    }
    return pending;
  };
  return { canonical, failed, requests, acquire };
}

describe('browser module-map aware runtime acquisition', () => {
  it('retains the negative control: clearing a Promise cannot refetch a failed module URL', async () => {
    const f = cachedFailure();
    await expect(f.acquire(f.canonical)).rejects.toBe(f.failed);
    await expect(f.acquire(f.canonical)).rejects.toBe(f.failed);
    expect(f.requests).toEqual([f.canonical]);
  });

  it('refetches the build-bound same-origin URL on the next attempt and shares success', async () => {
    const f = cachedFailure();
    const load = retryableModule(() => f.acquire(f.canonical), f.canonical, f.acquire);
    const first = load();
    expect(load()).toBe(first);
    await expect(first).rejects.toBe(f.failed);
    const retry = load();
    expect(load()).toBe(retry);
    const next = `${f.canonical}?pui-runtime-retry=1`;
    await expect(retry).resolves.toEqual({ value: next });
    expect(f.requests).toEqual([f.canonical, next]);
    expect(load()).toBe(retry);
  });

  it('does not automatically hide a failed retry and gives the next user attempt another URL', async () => {
    const acquire = vi.fn().mockRejectedValueOnce(new Error('still offline')).mockResolvedValue({});
    const load = retryableModule(
      () => Promise.reject(new Error('offline')),
      '/runtime.js?v=pin',
      acquire
    );
    await expect(load()).rejects.toThrow('offline');
    await expect(load()).rejects.toThrow('still offline');
    expect(acquire).toHaveBeenCalledTimes(1);
    await expect(load()).resolves.toEqual({});
    expect(acquire.mock.calls.map(([url]) => new URL(url).search)).toEqual([
      '?v=pin&pui-runtime-retry=1',
      '?v=pin&pui-runtime-retry=2',
    ]);
  });

  it.each([
    'https://untrusted.invalid/runtime.js',
    'data:text/javascript,export{}',
    'javascript:alert(1)',
  ])('rejects a non-same-origin executable binding %s', async (url) => {
    const acquire = vi.fn();
    const load = retryableModule(() => Promise.reject(new Error('offline')), url, acquire);
    await expect(load()).rejects.toThrow('offline');
    await expect(load()).rejects.toThrow('same-origin module');
    expect(acquire).not.toHaveBeenCalled();
  });

  it('does not import a URL supplied by the thrown error', async () => {
    const acquire = vi.fn().mockResolvedValue({});
    const load = retryableModule(
      () => Promise.reject(new Error('https://untrusted.invalid/evil.js')),
      '/bound.js',
      acquire
    );
    await expect(load()).rejects.toThrow('untrusted.invalid');
    await load();
    expect(acquire).toHaveBeenCalledWith(
      new URL('/bound.js?pui-runtime-retry=1', location.href).href
    );
  });
});
