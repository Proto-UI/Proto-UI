import { expect, it, vi } from 'vitest';
import {
  createSiteSearchData,
  type SiteSearchSnapshot,
  type SitePagefindApi,
} from './site-search-data';
const result = (title: string, url = '/docs/') => ({
  results: [{ id: title, data: async () => ({ url, meta: { title } }) }],
});

it('retains engine rank, resolves only current IDs and does not re-filter snippets', async () => {
  const states: SiteSearchSnapshot[] = [];
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    load: async () => ({ search: async () => result('A title') }),
    publish: (s) => states.push(s),
  });
  await bridge.search('matched body text');
  const ready = states.at(-1)!;
  expect(ready.query).toBe('matched body text');
  expect(ready.rows.map((row) => row.title)).toEqual(['A title']);
  expect(bridge.resolveExecution(ready.rows[0]!.id)).toBe('/docs/');
  expect(bridge.resolveExecution('https://evil.invalid/')).toBeNull();
});

it('rejects old completions after a newer query, IME invalidation and disposal', async () => {
  let resolve!: (result: Awaited<ReturnType<SitePagefindApi['search']>>) => void;
  const search = vi.fn(
    () =>
      new Promise<Awaited<ReturnType<SitePagefindApi['search']>>>((done) => {
        resolve = done;
      })
  );
  const states: SiteSearchSnapshot[] = [];
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    load: async () => ({ search }),
    publish: (s) => states.push(s),
  });
  const pending = bridge.search('old');
  await Promise.resolve();
  await bridge.search('composing', true);
  resolve(result('old'));
  await pending;
  expect(states.at(-1)).toEqual({
    query: 'composing',
    phase: 'idle',
    rows: [],
    resultCount: 0,
    hasMore: false,
    loadingMore: false,
    moreError: false,
  });
  bridge.dispose();
  await bridge.search('later');
  expect(search).toHaveBeenCalledTimes(1);
});

it('publishes empty separately from failure and allows retry', async () => {
  const search = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ results: [] });
  const states: SiteSearchSnapshot[] = [];
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    load: async () => ({ search }),
    publish: (s) => states.push(s),
  });
  await bridge.search('x');
  expect(states.at(-1)?.phase).toBe('error');
  await bridge.retry();
  expect(states.at(-1)?.phase).toBe('empty');
});

it('rejects foreign URLs instead of making result text executable', async () => {
  let state!: SiteSearchSnapshot;
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    load: async () => ({
      search: async () => result('<script>unsafe</script>', 'javascript:alert(1)'),
    }),
    publish: (s) => {
      state = s;
    },
  });
  await bridge.search('x');
  expect(state.phase).toBe('error');
  expect(state.rows).toEqual([]);
});

it('loads every ranked document and its anchors without a silent fixed row cap', async () => {
  const states: SiteSearchSnapshot[] = [];
  const data = [
    {
      url: '/a/',
      meta: { title: 'A' },
      sub_results: [
        { url: '/a/#one', title: 'One' },
        { url: '/a/#two', title: 'Two' },
      ],
    },
    { url: '/b/', meta: { title: 'B' }, sub_results: [{ url: '/a/#one', title: 'Duplicate' }] },
    { url: '/c/', meta: { title: 'C' } },
  ].map((value, index) => ({ id: String(index), data: vi.fn(async () => value) }));
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    pageSize: 1,
    load: async () => ({ search: async () => ({ results: data }) }),
    publish: (state) => states.push(state),
  });
  await bridge.search('ranked');
  expect(states.at(-1)!.rows.map((row) => row.href)).toEqual(['/a/', '/a/#one', '/a/#two']);
  expect(states.at(-1)).toMatchObject({ resultCount: 3, hasMore: true, loadingMore: false });
  expect(states.at(-1)).toMatchObject({
    hasMore: true,
    loadingMore: false,
    moreError: false,
    resultCount: 3,
  });
  expect(data[1]!.data).not.toHaveBeenCalled();
  await bridge.loadMore();
  await bridge.loadMore();
  expect(states.at(-1)!.rows.map((row) => row.href)).toEqual([
    '/a/',
    '/a/#one',
    '/a/#two',
    '/b/',
    '/c/',
  ]);
  expect(states.at(-1)).toMatchObject({ phase: 'ready', hasMore: false, moreError: false });
});

it('retains current rows on next-page failure and retries that page without duplication', async () => {
  let state!: SiteSearchSnapshot;
  const next = vi
    .fn()
    .mockRejectedValueOnce(new Error('temporary'))
    .mockResolvedValue({ url: '/b/', meta: { title: 'B' } });
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    pageSize: 1,
    load: async () => ({
      search: async () => ({
        results: [
          { id: 'a', data: async () => ({ url: '/a/' }) },
          { id: 'b', data: next },
        ],
      }),
    }),
    publish: (value) => {
      state = value;
    },
  });
  await bridge.search('query');
  const first = state.rows[0]!;
  await bridge.loadMore();
  expect(state).toMatchObject({
    phase: 'ready',
    hasMore: true,
    moreError: true,
    loadingMore: false,
  });
  expect(bridge.resolveExecution(first.id)).toBe('/a/');
  await bridge.retry();
  expect(next).toHaveBeenCalledTimes(2);
  expect(state.rows.map((row) => row.href)).toEqual(['/a/', '/b/']);
  expect(state.moreError).toBe(false);
});

it('invalidates pending data and executable IDs on close, then reopens the retained query', async () => {
  let resolve!: (value: { url: string }) => void;
  let state!: SiteSearchSnapshot;
  const data = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    )
    .mockResolvedValue({ url: '/new/' });
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    load: async () => ({ search: async () => ({ results: [{ id: 'result', data }] }) }),
    publish: (value) => {
      state = value;
    },
  });
  const pending = bridge.search('retained');
  for (let i = 0; i < 4; i++) await Promise.resolve();
  bridge.cancel();
  expect(state).toMatchObject({ query: 'retained', phase: 'idle', rows: [], hasMore: false });
  resolve({ url: '/stale/' });
  await pending;
  expect(state.phase).toBe('idle');
  await bridge.retry();
  expect(state.rows.map((row) => row.href)).toEqual(['/new/']);
});

it('does not let an older query overwrite a newer completed query', async () => {
  let resolveOld!: (value: ReturnType<typeof result>) => void;
  let state!: SiteSearchSnapshot;
  const search = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolveOld = done;
        })
    )
    .mockResolvedValue(result('New', '/new/'));
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    load: async () => ({ search }),
    publish: (value) => {
      state = value;
    },
  });
  const old = bridge.search('old');
  await Promise.resolve();
  await bridge.search('new');
  resolveOld(result('Old', '/old/'));
  await old;
  expect(state.query).toBe('new');
  expect(state.rows.map((row) => row.href)).toEqual(['/new/']);
});

it('coalesces repeated next-page requests and ignores completion after disposal', async () => {
  let resolve!: (value: { url: string }) => void;
  const states: SiteSearchSnapshot[] = [];
  const next = vi.fn(
    () =>
      new Promise<{ url: string }>((done) => {
        resolve = done;
      })
  );
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    pageSize: 1,
    load: async () => ({
      search: async () => ({
        results: [
          { id: 'a', data: async () => ({ url: '/a/' }) },
          { id: 'b', data: next },
        ],
      }),
    }),
    publish: (value) => states.push(value),
  });
  await bridge.search('x');
  const pending = bridge.loadMore();
  await bridge.loadMore();
  expect(next).toHaveBeenCalledTimes(1);
  bridge.dispose();
  const count = states.length;
  resolve({ url: '/b/' });
  await pending;
  expect(states.length).toBe(count);
});

it('validates formatter output too while preserving locale, query and fragment', async () => {
  let state!: SiteSearchSnapshot;
  let unsafe = false;
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    load: async () => ({ search: async () => result('Title', '/zh-cn/docs/?x=1#example') }),
    formatURL: (path) => (unsafe ? '//elsewhere.invalid/docs/' : path),
    publish: (value) => {
      state = value;
    },
  });
  await bridge.search('title');
  expect(state.rows[0]!.href).toBe('/zh-cn/docs/?x=1#example');
  unsafe = true;
  await bridge.search('title');
  expect(state).toMatchObject({ phase: 'error', rows: [] });
});

it('rejects execution after cancel, disposal, or a newer unresolved query', async () => {
  let state!: SiteSearchSnapshot;
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    load: async () => ({ search: async () => result('Guide') }),
    publish: (value) => {
      state = value;
    },
  });
  await bridge.search('one');
  const oldReady = state;
  expect(bridge.resolveExecution(oldReady.rows[0]!.id)).toBe('/docs/');
  const pending = bridge.search('two');
  expect(bridge.resolveExecution(oldReady.rows[0]!.id)).toBeNull();
  await pending;
  bridge.cancel();
  expect(bridge.resolveExecution(oldReady.rows[0]!.id)).toBeNull();
  await bridge.retry();
  const latest = state;
  bridge.dispose();
  expect(latest.phase).toBe('ready'); // A retained snapshot cannot authorize execution.
  expect(bridge.resolveExecution(latest.rows[0]!.id)).toBeNull();
});

it('does not let published row mutation change live execution authorization', async () => {
  let state!: SiteSearchSnapshot;
  const bridge = createSiteSearchData({
    origin: 'https://proto-ui.dev',
    load: async () => ({ search: async () => result('Guide') }),
    publish: (value) => {
      state = value;
    },
  });
  await bridge.search('guide');
  const originalId = state.rows[0]!.id;
  state.rows[0]!.href = 'javascript:alert(1)';
  state.rows[0]!.id = 'forged';
  state.rows[0]!.title = 'Changed by consumer';
  expect(bridge.resolveExecution(originalId)).toBe('/docs/');
  expect(bridge.resolveExecution('forged')).toBeNull();
  await bridge.retry();
  expect(state.rows[0]).toMatchObject({ id: originalId, href: '/docs/', title: 'Guide' });
});
