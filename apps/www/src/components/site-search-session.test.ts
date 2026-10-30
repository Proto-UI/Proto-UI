import { describe, expect, it, vi } from 'vitest';
import { createSiteSearchSession } from './site-search-session';

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
describe('Search data lifetime is separate from reusable views', () => {
  it('does not submit partial IME; executes only current live results and cancels on close', async () => {
    const search = vi.fn(async (query: string) => ({
      results: [
        {
          id: query,
          data: async () => ({ url: `/${query}/`, meta: { title: query } }),
        },
      ],
    }));
    const navigate = vi.fn();
    const session = createSiteSearchSession({
      origin: 'https://proto-ui.dev',
      load: async () => ({ search }),
      navigate,
    });
    session.input('closed', false);
    expect(search).not.toHaveBeenCalled();
    session.setOpen(true);
    session.input('中', true);
    await flush();
    expect(search).not.toHaveBeenCalled();
    session.input('中文', false);
    await flush();
    expect(search).toHaveBeenCalledExactlyOnceWith('中文');
    const selected = session.read().snapshot.rows[0]!;
    expect(session.execute(selected.id)).toBe(true);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/%E4%B8%AD%E6%96%87/');
    expect(session.read().open).toBe(false);
    expect(session.execute(selected.id)).toBe(false);
    session.setOpen(true);
    await flush();
    expect(session.read().snapshot.query).toBe('中文');
    expect(session.read().snapshot.rows).toHaveLength(1);
    session.dispose();
    expect(session.execute(session.read().snapshot.rows[0]?.id ?? '')).toBe(false);
  });
  it('late query completion cannot resurrect a closed or disposed view', async () => {
    let resolve!: (value: { results: [] }) => void;
    const search = vi.fn(
      () =>
        new Promise<{ results: [] }>((done) => {
          resolve = done;
        })
    );
    const session = createSiteSearchSession({
      origin: 'https://proto-ui.dev',
      load: async () => ({ search }),
      navigate: vi.fn(),
    });
    const observer = vi.fn();
    session.subscribe(observer);
    session.setOpen(true);
    session.input('pending', false);
    await flush();
    session.setOpen(false);
    const last = session.read();
    const count = observer.mock.calls.length;
    resolve({ results: [] });
    await flush();
    expect(session.read()).toEqual(last);
    expect(observer).toHaveBeenCalledTimes(count);
    session.dispose();
    session.setOpen(true);
    expect(session.read().open).toBe(false);
  });
});

it('prepares on empty-query open, exposes failure and retries without submitting an empty search', async () => {
  const search = vi.fn(async () => ({ results: [] }));
  const load = vi.fn().mockRejectedValueOnce(new Error('HEAD 503')).mockResolvedValue({ search });
  const session = createSiteSearchSession({ origin: 'https://docs.test', load, navigate: vi.fn() });
  session.setOpen(true);
  expect(session.read().snapshot.phase).toBe('loading');
  await flush();
  expect(session.read().snapshot.phase).toBe('error');
  session.retry();
  expect(session.read().snapshot.phase).toBe('loading');
  await flush();
  expect(session.read().snapshot.phase).toBe('idle');
  expect(load).toHaveBeenCalledTimes(2);
  expect(search).not.toHaveBeenCalled();
  session.input('button', false);
  await flush();
  expect(search).toHaveBeenCalledExactlyOnceWith('button');
  session.dispose();
});

it('late empty-query preparation cannot overwrite newer results or resurrect a closed session', async () => {
  let finish!: (api: { search: () => Promise<{ results: [] }> }) => void;
  const search = vi.fn(async () => ({ results: [] as [] }));
  const load = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValue({ search });
  const session = createSiteSearchSession({ origin: 'https://docs.test', load, navigate: vi.fn() });
  session.setOpen(true);
  session.input('current', false);
  await flush();
  expect(session.read().snapshot.phase).toBe('empty');
  finish({ search });
  await flush();
  expect(session.read().snapshot).toMatchObject({ phase: 'empty', query: 'current' });
  session.setOpen(false);
  expect(session.read().open).toBe(false);
  session.dispose();
});
