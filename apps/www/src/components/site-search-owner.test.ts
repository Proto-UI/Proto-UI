import { beforeEach, describe, expect, it, vi } from 'vitest';
const resource = vi.hoisted(() => ({ create: vi.fn(), load: vi.fn(), dispose: vi.fn() }));
vi.mock('./site-pagefind-resource', () => ({
  createSitePagefindResource: (options: unknown) => {
    resource.create(options);
    return { load: resource.load, dispose: resource.dispose };
  },
}));
import { createSiteSearchOwner } from './site-search-owner';
const copy = {
  title: 'Search',
  description: 'Documents',
  placeholder: 'Search documents',
  hint: 'Type',
  loading: 'Loading',
  empty: 'None',
  error: 'Unavailable',
  retry: 'Retry',
  more: 'More',
  close: 'Close',
  count: '{count} documents',
};
const root = () => {
  const element = document.createElement('site-search');
  element.dataset.searchCopy = JSON.stringify(copy);
  element.dataset.pagefindBundle = '/pagefind/';
  return element;
};
beforeEach(() => {
  resource.create.mockReset();
  resource.dispose.mockReset();
  resource.load.mockReset().mockResolvedValue({ search: async () => ({ results: [] }) });
});
const flush = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve();
};
describe('Search resource ownership and localized configuration', () => {
  it('validates localized copy before any resource acquisition and preserves explicit count copy', () => {
    const missing = root();
    missing.dataset.searchCopy = JSON.stringify({ ...copy, title: null });
    expect(() => createSiteSearchOwner(missing)).toThrow('Missing Search copy: title');
    expect(resource.create).not.toHaveBeenCalled();
    const missingCount = root();
    missingCount.dataset.searchCopy = JSON.stringify({ ...copy, count: null });
    expect(() => createSiteSearchOwner(missingCount)).toThrow('Missing Search copy: count');
    expect(resource.create).not.toHaveBeenCalled();
    const element = root();
    const owner = createSiteSearchOwner(element);
    expect(owner.copy.count(23)).toBe('23 documents');
    expect(resource.create.mock.calls[0][0]).toMatchObject({
      bundleURL: '/pagefind/',
      origin: window.location.origin,
    });
    expect(resource.load).not.toHaveBeenCalled();
    owner.dispose();
    owner.dispose();
    expect(resource.dispose).toHaveBeenCalledTimes(1);
  });
  it('intent preparation failure remains retryable; disposed completion cannot publish readiness', async () => {
    let complete!: (value: unknown) => void;
    resource.load.mockRejectedValueOnce(new Error('unavailable')).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const element = root();
    const owner = createSiteSearchOwner(element);
    owner.prepare();
    await flush();
    expect(element.dataset.searchPreparation).toBe('unavailable');
    owner.prepare();
    owner.dispose();
    complete({ search: async () => ({ results: [] }) });
    await flush();
    expect(element.dataset.searchPreparation).toBe('unavailable');
    owner.prepare();
    expect(resource.load).toHaveBeenCalledTimes(2);
  });
});
