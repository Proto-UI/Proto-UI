import { describe, expect, it, vi } from 'vitest';
import { createSiteSearchSession } from './site-search-session';
import type { SitePagefindApi } from './site-search-data';

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const navigation = [
  { title: 'Home', href: '/en/' },
  { title: 'Docs', href: '/en/start-here/what-you-saw/' },
];
const api: SitePagefindApi = {
  search: async (query: string) => ({
    results: [
      {
        id: query,
        data: async () => ({
          url: `/en/docs/${query}/`,
          meta: { title: query },
          sub_results: [{ url: `/en/docs/${query}/#all-anchors`, title: 'All anchors' }],
        }),
      },
    ],
  }),
};

describe('real default navigation is separate from Pagefind search results', () => {
  it('opens real navigation without submitting an empty search and closes exactly once on execution', async () => {
    const search = vi.fn(api.search);
    const navigate = vi.fn();
    const session = createSiteSearchSession({
      origin: 'https://docs.test',
      navigation,
      navigate,
      load: async () => ({ search }),
    });
    session.setOpen(true);
    await flush();
    expect(search).not.toHaveBeenCalled();
    expect(session.read().snapshot.rows).toEqual([]);
    expect(session.read().snapshot.resultCount).toBe(0);
    expect(session.read().navigation.map((x) => x.title)).toEqual(['Home', 'Docs']);
    const id = session.read().navigation[1]!.id;
    expect(session.execute(id)).toBe(true);
    expect(session.read().open).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/en/start-here/what-you-saw/');
    expect(session.execute(id)).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    session.dispose();
  });
  it('rejects retained default rows during a query/IME, preserves every actual anchor and restores navigation after clear', async () => {
    const navigate = vi.fn();
    const session = createSiteSearchSession({
      origin: 'https://docs.test',
      navigation,
      navigate,
      load: async () => api,
    });
    session.setOpen(true);
    await flush();
    const id = session.read().navigation[0]!.id;
    session.input('partial', true);
    await flush();
    expect(session.execute(id)).toBe(false);
    session.input('button', false);
    await flush();
    expect(session.execute(id)).toBe(false);
    expect(session.read().snapshot.rows.map((x) => x.href)).toEqual([
      '/en/docs/button/',
      '/en/docs/button/#all-anchors',
    ]);
    const staleResult = session.read().snapshot.rows[1]!.id;
    session.input('', false);
    await flush();
    expect(session.execute(staleResult)).toBe(false);
    expect(session.execute(id)).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/en/');
    session.dispose();
  });
  it('retains navigation and the independent error/retry state when Pagefind preparation fails', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('controlled404')).mockResolvedValue(api);
    const session = createSiteSearchSession({
      origin: 'https://docs.test',
      navigation,
      navigate: vi.fn(),
      load,
    });
    session.setOpen(true);
    await flush();
    expect(session.read().snapshot.phase).toBe('error');
    expect(session.read().navigation).toHaveLength(2);
    session.retry();
    await flush();
    expect(session.read().snapshot.phase).toBe('idle');
    expect(session.read().navigation).toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(2);
    session.dispose();
  });
  it('does not grant navigation authority to caller mutations or after disposal', async () => {
    const source = navigation.map((x) => ({ ...x }));
    const navigate = vi.fn();
    const session = createSiteSearchSession({
      origin: 'https://docs.test',
      navigation: source,
      navigate,
      load: async () => api,
    });
    source[0]!.href = 'https://evil.test/';
    session.setOpen(true);
    await flush();
    const row = session.read().navigation[0]!;
    row.href = 'https://evil.test/';
    expect(session.execute(row.id)).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/en/');
    session.dispose();
    expect(session.execute(row.id)).toBe(false);
  });
  it('rejects off-site, non-http and post-format off-site destinations', () => {
    for (const href of ['https://evil.test/', 'javascript:alert(1)', '//evil.test/'])
      expect(() =>
        createSiteSearchSession({
          origin: 'https://docs.test',
          navigation: [{ title: 'Invalid', href }],
          navigate: vi.fn(),
          load: async () => api,
        })
      ).toThrow(/current site/);
    expect(() =>
      createSiteSearchSession({
        origin: 'https://docs.test',
        navigation,
        navigate: vi.fn(),
        load: async () => api,
        formatURL: () => 'https://evil.test/',
      })
    ).toThrow(/current site/);
  });
  it('never resolves an old hidden Pagefind row while blank-query navigation is current, even after a late completion', async () => {
    let finish!: (value: {
      results: Array<{ id: string; data(): Promise<{ url: string }> }>;
    }) => void;
    const search = vi
      .fn(api.search)
      .mockImplementationOnce(api.search)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
    const navigate = vi.fn();
    const session = createSiteSearchSession({
      origin: 'https://docs.test',
      navigation,
      navigate,
      load: async () => ({ search }),
    });
    session.setOpen(true);
    await flush();
    session.input('first', false);
    await flush();
    const old = session.read().snapshot.rows[0]!.id;
    session.input('pending', false);
    await flush();
    session.input('', false);
    await flush();
    expect(session.execute(old)).toBe(false);
    expect(session.read().navigation).toHaveLength(2);
    finish({ results: [{ id: 'late', data: async () => ({ url: '/en/docs/late/' }) }] });
    await flush();
    expect(session.read().snapshot.rows).toEqual([]);
    expect(session.execute(old)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(session.read().open).toBe(true);
    session.dispose();
  });
  it('deduplicates normalized same-site targets without hiding unrelated pages', () => {
    const session = createSiteSearchSession({
      origin: 'https://docs.test',
      navigation: [...navigation, navigation[0]!],
      navigate: vi.fn(),
      load: async () => api,
    });
    expect(session.read().navigation).toHaveLength(2);
    session.dispose();
  });
});
