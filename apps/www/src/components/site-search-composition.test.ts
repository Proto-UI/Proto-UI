import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSiteSearchComposition, type SiteSearchCopy } from './site-search-composition';
import { createSiteSearchSession } from './site-search-session';
import { renderDemo } from './PrototypePreviewer/demo-renderer';
import { collectPrototypeIds, type DemoSetupContext } from './PrototypePreviewer/demo-types';
import { loadPrototypes, prototypeModules } from './PrototypePreviewer/prototype-modules';
// Only CDN acquisition is substituted; hosts, adapters, instances and binding helper are real.
vi.mock('./PrototypePreviewer/runtimes/react-runtime', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/runtimes/react-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/react/package.json'));
  return {
    ...actual,
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./PrototypePreviewer/runtimes/vue-runtime', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/runtimes/vue-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue/package.json'));
  return { ...actual, loadVue: async () => require('vue') };
});
vi.mock('./PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue2/package.json'));
  return { ...actual, loadVue2: async () => require('vue') };
});

const copy: SiteSearchCopy = {
  title: 'Search documentation',
  description: 'Search and open a document',
  placeholder: 'Search',
  hint: 'Type a query',
  loading: 'Loading',
  empty: 'No results',
  error: 'Unavailable',
  retry: 'Retry',
  more: 'More',
  close: 'Close',
  count: (n) => `${n} documents`,
};
const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  const failures: unknown[] = [];
  for (const cleanup of cleanups.splice(0).reverse()) {
    try {
      await cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  document.body.replaceChildren();
  if (failures.length) throw new AggregateError(failures, 'Search test cleanup failed');
});

describe('public Search composition, actual prototype loaders and four hosts', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    for (const family of ['shadcn', 'brutalist'] as const) {
      it(`${runtime}/${family}: latest prepared query, stable editor, async rows, close and reopen`, async () => {
        const searched: string[] = [];
        const navigate = vi.fn();
        const longError = 'Search is temporarily unavailable; retain all explanatory text. '.repeat(
          8
        );
        const longRetry = 'Retry the complete documentation search';
        const longLoading = 'Loading the complete documentation search, please wait. '.repeat(6);
        let firstFailure = true;
        let retryBarrier: Promise<void> | undefined;
        let releaseRetry: (() => void) | undefined;
        let reopenBarrier: Promise<void> | undefined;
        let releaseReopen: (() => void) | undefined;
        const session = createSiteSearchSession({
          origin: 'https://docs.test',
          navigate,
          load: async () => ({
            search: async (query) => {
              searched.push(query);
              if (reopenBarrier) await reopenBarrier;
              if (query === 'failed-query') {
                if (firstFailure) {
                  firstFailure = false;
                  throw new Error('Controlled transport failure');
                }
                if (retryBarrier) await retryBarrier;
                return { results: [] };
              }
              if (query === 'unmatched-query') return { results: [] };
              return {
                results: Array.from({ length: 23 }, (_, i) => ({
                  id: `${query}-${i}`,
                  data: async () => ({
                    url: `/docs/${query}/${i}`,
                    meta: { title: `${query} ${i}` },
                  }),
                })),
              };
            },
          }),
        });
        cleanups.push(() => session.dispose());
        let active = false;
        const errors: unknown[] = [];
        const composition = createSiteSearchComposition({
          family,
          shadcnStyle: 'rhea',
          session,
          copy: { ...copy, error: longError, retry: longRetry, loading: longLoading },
          isCurrent: () => active,
          onFailure: (error) => errors.push(error),
        });
        const ids = new Set<string>();
        collectPrototypeIds(composition.demo.root, ids);
        for (const id of ids)
          expect(prototypeModules[id], `real loader for ${id}`).toBeTypeOf('function');
        await loadPrototypes([...ids]);
        let context!: DemoSetupContext;
        const setup = composition.demo.setup!;
        composition.demo.setup = (ctx) => {
          context = ctx;
          return setup(ctx);
        };
        const host = document.createElement('div');
        document.body.append(host);
        const view = await renderDemo({ host, runtime, demo: composition.demo });
        cleanups.push(() => view.destroy());
        session.setOpen(true);
        session.input('prepared-latest', false);
        await vi.waitFor(() => expect(session.read().snapshot.phase).toBe('ready'));
        active = true;
        composition.activate();
        const editor = () => {
          const ref = context.refs.query;
          return ref.matches('input') ? (ref as HTMLInputElement) : ref.querySelector('input')!;
        };
        await vi.waitFor(() => {
          expect(context.refs.results.textContent).toContain('prepared-latest 19');
          expect(editor().value).toBe('prepared-latest');
        });
        const scrollBody = context.refs['scroll-body'];
        const dismissal = context.refs.dismissal;
        expect(scrollBody.contains(context.refs.results)).toBe(true);
        expect(scrollBody.contains(context.refs.status)).toBe(true);
        expect(scrollBody.contains(context.refs.actions)).toBe(true);
        expect(scrollBody.contains(context.refs.close)).toBe(false);
        expect(dismissal.contains(context.refs.close)).toBe(true);
        expect(scrollBody.parentElement).toBe(dismissal.parentElement);
        expect(context.refs.status.getAttribute('role')).toBe('status');
        expect(context.refs.status.getAttribute('aria-live')).toBe('polite');
        const input = editor();
        const instance = context.api.getPublicInstance!('query');
        expect(searched).toEqual(['prepared-latest']);
        context.api.call('command', 'setInputValue', 'failed-query', false);
        await vi.waitFor(() => {
          expect(session.read().snapshot.phase).toBe('error');
          expect(context.refs.status.textContent).toBe(longError);
          expect(context.refs.actions.textContent).toBe(longRetry);
          expect(context.refs['search-page-action']).toBeDefined();
        });
        expect(scrollBody.contains(context.refs['search-page-action'])).toBe(true);
        expect(dismissal.contains(context.refs.close)).toBe(true);
        retryBarrier = new Promise<void>((resolve) => {
          releaseRetry = resolve;
        });
        context.refs['search-page-action'].click();
        await vi.waitFor(() => {
          expect(context.refs.actions.textContent).toBe(longLoading);
          expect(dismissal.contains(context.refs.close)).toBe(true);
        });
        releaseRetry!();
        await vi.waitFor(() => {
          expect(session.read().snapshot.phase).toBe('empty');
          expect(context.refs.results.textContent).toBe('No results');
          expect(context.refs.status.textContent).toBe('0 documents');
          expect(context.refs.actions.textContent).toBe('');
        });
        expect(editor()).toBe(input);
        expect(context.api.getPublicInstance!('query')).toBe(instance);

        context.api.call('command', 'setInputValue', 'unmatched-query', false);
        await vi.waitFor(() => expect(context.refs.results.textContent).toBe('No results'));
        expect(editor()).toBe(input);
        context.api.call('command', 'setInputValue', 'next', false);
        await vi.waitFor(() => expect(context.refs.results.textContent).toContain('next 19'));
        expect(editor()).toBe(input);
        expect(context.api.getPublicInstance!('query')).toBe(instance);
        expect(context.refs.results.textContent).not.toContain('prepared-latest');
        session.loadMore();
        await vi.waitFor(() => expect(context.refs.results.textContent).toContain('next 22'));
        expect(context.refs.close.querySelector('[role=button], button')).toBeNull();
        const retiredRow = session.read().snapshot.rows[0]!;
        context.refs.close.click();
        await vi.waitFor(() => expect(session.read().open).toBe(false));
        expect(session.execute(retiredRow.id)).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
        reopenBarrier = new Promise<void>((resolve) => {
          releaseReopen = resolve;
        });
        session.setOpen(true);
        expect(session.read().snapshot.phase).toBe('loading');
        expect(session.read().snapshot.rows).toEqual([]);
        // A retained exit/reentry DOM row is not authorization to execute it.
        context.api.call('command', 'select', retiredRow.id);
        expect(session.execute(retiredRow.id)).toBe(false);
        expect(session.read().open).toBe(true);
        expect(navigate).not.toHaveBeenCalled();
        releaseReopen!();
        await vi.waitFor(() => {
          const current = session.read().snapshot;
          expect(current.phase).toBe('ready');
          expect(current.query).toBe('next');
          expect(current.rows).toHaveLength(20);
          expect(context.refs.results.textContent).toContain('next 19');
          expect(context.refs.results.textContent).not.toContain('next 22');
        });
        expect(editor()).toBe(input);
        expect(editor().value).toBe('next');
        const row = session.read().snapshot.rows[0]!;
        context.api.call('command', 'select', row.id);
        await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/docs/next/0'));
        expect(session.read().open).toBe(false);
        expect(errors).toEqual([]);
      });
    }
  }
});

it('opens through the public Dialog even when its closed Command has no instance yet (contract negative control)', async () => {
  const session = createSiteSearchSession({
    origin: 'https://docs.test',
    navigate: vi.fn(),
    load: async () => ({ search: async () => ({ results: [] }) }),
  });
  const events: string[] = [];
  let command: { getExposes(): Record<string, unknown> } | undefined;
  let creating = false;
  let notify: (
    snapshot: Readonly<Record<string, typeof command>>,
    revision: number
  ) => void = () => {};
  const composition = createSiteSearchComposition({
    family: 'brutalist',
    shadcnStyle: 'rhea',
    session,
    copy,
    isCurrent: () => true,
    onFailure: (error) => {
      throw error;
    },
  });
  const host = document.createElement('div');
  const status = document.createElement('div');
  const cleanup = composition.demo.setup!({
    host,
    refs: { status },
    api: {
      getPublicInstance: (ref) => (ref === 'command' ? command : undefined),
      subscribePublicInstances(_refs, listener) {
        notify = listener;
        listener(Object.freeze({ command: undefined }), 0);
        return () => {
          notify = () => {};
        };
      },
      setProps(ref, props) {
        if (ref !== 'dialog' || props.open !== true || creating) return;
        events.push('open-before-instance');
        creating = true;
        queueMicrotask(() => {
          command = { getExposes: () => ({}) };
          events.push('identity-created');
          notify(Object.freeze({ command }), 1);
        });
      },
      getExposes() {
        return undefined;
      },
      call(ref, method) {
        events.push(`${ref}.${method}`);
      },
      async setChildren(ref) {
        events.push(`rows:${ref}`);
        return 'committed';
      },
    },
  });
  session.setOpen(true);
  composition.activate();
  await vi.waitFor(() => expect(events).toContain('rows:results'));
  expect(events.indexOf('open-before-instance')).toBeLessThan(events.indexOf('identity-created'));
  expect(events.indexOf('identity-created')).toBeLessThan(events.indexOf('command.setInputValue'));
  expect(events.indexOf('command.setInputValue')).toBeLessThan(events.indexOf('rows:results'));
  if (typeof cleanup === 'function') cleanup();
  session.dispose();
});
