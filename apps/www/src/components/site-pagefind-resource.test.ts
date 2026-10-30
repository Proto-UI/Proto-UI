import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSitePagefindResource } from './site-pagefind-resource';

afterEach(() => vi.useRealTimers());
describe('Pagefind data API resource, never default UI', () => {
  it('loads once and retains ranked lazy handles without an arbitrary result cap', async () => {
    const data = vi.fn(async () => ({ url: '/result/' }));
    const search = vi.fn(async () => ({
      results: Array.from({ length: 55 }, (_, i) => ({ id: String(i), data })),
    }));
    const configure = vi.fn(async () => {});
    const importModule = vi.fn(async () => ({ options: configure, search }));
    const probe = vi.fn(async () => new Response(null, { status: 200 }));
    const resource = createSitePagefindResource({
      bundleURL: '/docs/pagefind/',
      origin: 'https://proto-ui.dev',
      apiOptions: { baseUrl: '/docs/' },
      importModule,
      fetch: probe,
    });
    const [first, second] = await Promise.all([resource.load(), resource.load()]);
    expect(first).toBe(second);
    expect(importModule).toHaveBeenCalledTimes(1);
    expect(importModule).toHaveBeenCalledWith('https://proto-ui.dev/docs/pagefind/pagefind.js');
    expect(configure).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledWith({ baseUrl: '/docs/' });
    const found = await first.search('test');
    expect(found.results).toHaveLength(55);
    expect(data).not.toHaveBeenCalled();
    await found.results[54]!.data();
    expect(data).toHaveBeenCalledTimes(1);
    resource.dispose();
    await expect(first.search('retired')).rejects.toThrow('disposed');
    await expect(found.results[0]!.data()).rejects.toThrow('disposed');
    expect(search).toHaveBeenCalledTimes(1);
    expect(data).toHaveBeenCalledTimes(1);
  });
  it('fails bounded waiting, retries a failed preparation and never calls a disposed engine', async () => {
    vi.useFakeTimers();
    const importModule = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValue({ options: async () => {}, search: async () => ({ results: [] }) });
    const resource = createSitePagefindResource({
      bundleURL: '/pagefind/',
      origin: 'https://proto-ui.dev',
      timeoutMs: 50,
      importModule,
      fetch: vi.fn(async () => new Response(null, { status: 200 })),
    });
    const pending = resource.load();
    const rejected = expect(pending).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    const retry = await resource.load();
    expect(await retry.search('ok')).toEqual({ results: [] });
    resource.dispose();
    await expect(resource.load()).rejects.toThrow('disposed');
    expect(importModule).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects cross-origin bundles and missing indexes without importing code', async () => {
    const importModule = vi.fn();
    expect(() =>
      createSitePagefindResource({
        bundleURL: 'https://other.test/pagefind/',
        origin: 'https://proto-ui.dev',
        importModule,
      })
    ).toThrow('same-origin');
    const resource = createSitePagefindResource({
      bundleURL: '/pagefind/',
      origin: 'https://proto-ui.dev',
      importModule,
      fetch: vi.fn(async () => new Response(null, { status: 404 })),
    });
    await expect(resource.load()).rejects.toThrow('index unavailable');
    expect(importModule).not.toHaveBeenCalled();
    resource.dispose();
  });
});

it('preserves falsy resource rejection instead of treating it as a successful value', async () => {
  const resource = createSitePagefindResource({
    bundleURL: '/pagefind/',
    origin: 'https://proto-ui.dev',
    fetch: vi.fn(async () => new Response(null, { status: 200 })),
    importModule: async () => Promise.reject(undefined),
  });
  let rejected = false;
  try {
    await resource.load();
  } catch (error) {
    rejected = true;
    expect(error).toBeUndefined();
  }
  expect(rejected).toBe(true);
  resource.dispose();
});
