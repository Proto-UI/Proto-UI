import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSiteSearchComposition, type SiteSearchCopy } from './site-search-composition';
import { createSiteSearchSession } from './site-search-session';
import { renderDemo } from './PrototypePreviewer/demo-renderer';
import {
  collectPrototypeIds,
  type DemoSetupContext,
  type DemoChildrenCommit,
} from './PrototypePreviewer/demo-types';
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
    refs: {
      status,
      results: document.createElement('div'),
      'keyboard-hint': document.createElement('div'),
    },
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

for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
  it(`${runtime}: actual menu composition shows safe default Pages, glyphs and footer and keeps one editor across query changes`, async () => {
    const navigate = vi.fn();
    const errors: unknown[] = [];
    const session = createSiteSearchSession({
      origin: 'https://docs.test',
      navigate,
      navigation: [
        { title: 'Home', href: '/en/' },
        { title: 'Docs', href: '/en/start-here/what-you-saw/' },
      ],
      load: async () => ({
        search: async (query) => ({
          results: [
            {
              id: query,
              data: async () => ({
                url: '/en/docs/button/',
                meta: { title: 'Button' },
                sub_results: [{ url: '/en/docs/button/#anchor', title: 'Button anchor' }],
              }),
            },
          ],
        }),
      }),
    });
    cleanups.push(() => session.dispose());
    const composition = createSiteSearchComposition({
      family: 'shadcn',
      shadcnStyle: 'rhea',
      session,
      copy: { ...copy, pages: 'Pages', results: 'Results', goToPage: 'Go to page' },
      isCurrent: () => true,
      onFailure: (error) => errors.push(error),
    });
    const ids = new Set<string>();
    collectPrototypeIds(composition.demo.root, ids);
    for (const id of ids)
      expect(prototypeModules[id], `actual lazy closure ${id}`).toBeTypeOf('function');
    await loadPrototypes([...ids]);
    let context!: DemoSetupContext;
    const setup = composition.demo.setup!;
    const hintWrites: Array<{ target: HTMLElement; outcome?: DemoChildrenCommit }> = [];
    composition.demo.setup = (ctx) => {
      context = {
        ...ctx,
        api: {
          ...ctx.api,
          setChildren(ref, children) {
            if (ref !== 'keyboard-hint') return ctx.api.setChildren!(ref, children);
            const target = ctx.refs['keyboard-hint'];
            expect(target, 'hint writes bind a real author box').toBeInstanceOf(HTMLElement);
            const write: { target: HTMLElement; outcome?: DemoChildrenCommit } = { target };
            hintWrites.push(write);
            return ctx.api.setChildren!(ref, children).then((outcome) => {
              write.outcome = outcome;
              return outcome;
            });
          },
        },
      };
      return setup(context);
    };
    const host = document.createElement('div');
    document.body.append(host);
    const view = await renderDemo({ host, runtime, demo: composition.demo });
    cleanups.push(() => view.destroy());
    session.setOpen(true);
    composition.activate();
    const editor = () =>
      context.refs.query.matches('input')
        ? (context.refs.query as HTMLInputElement)
        : context.refs.query.querySelector('input')!;
    await vi.waitFor(() => expect(context.refs.results.textContent).toContain('PagesHomeDocs'));
    expect(context.refs.results.getAttribute('role')).toBe('group');
    expect(context.refs.results.getAttribute('aria-label')).toBe('Pages');
    expect(context.refs['query-decoration'].getAttribute('aria-hidden')).toBe('true');
    expect(context.refs['query-decoration'].querySelector('svg')).not.toBeNull();
    expect(context.refs['keyboard-hint'].textContent).toContain('Go to page');
    const initialHint = context.refs['keyboard-hint'];
    expect(initialHint.isConnected).toBe(true);
    // Initial ordinary -> portal mounting can retire one physical author box.
    // Bound that initialization, then require the settled box to survive all input changes.
    const initialTargets = new Set([...hintWrites.map((write) => write.target), initialHint]);
    expect(initialTargets.size).toBeLessThanOrEqual(2);
    for (const target of initialTargets)
      if (target !== initialHint) expect(target.isConnected).toBe(false);
    const assertHintOwnership = () => {
      expect(context.refs['keyboard-hint']).toBe(initialHint);
      expect(initialHint.isConnected).toBe(true);
      expect(initialHint.textContent).toContain('Go to page');
      for (const target of new Set(hintWrites.map((write) => write.target))) {
        expect(hintWrites.filter((write) => write.target === target)).toHaveLength(1);
        if (target !== initialHint) expect(target.isConnected).toBe(false);
      }
      expect(
        hintWrites.filter((write) => write.target === initialHint && write.outcome === 'committed')
      ).toHaveLength(1);
    };
    const input = editor();
    const instance = context.api.getPublicInstance!('query');
    context.api.call('command', 'setInputValue', 'button', false);
    await vi.waitFor(() => expect(context.refs.results.textContent).toContain('Button anchor'));
    expect(context.refs.results.textContent).not.toContain('Home');
    expect(context.refs.results.getAttribute('aria-label')).toBe('Results');
    await vi.waitFor(assertHintOwnership);
    const settledHintWrites = hintWrites.length;
    context.api.call('command', 'setInputValue', 'buttons', false);
    await vi.waitFor(() => expect(session.read().snapshot.query).toBe('buttons'));
    await vi.waitFor(() => expect(session.read().snapshot.phase).toBe('ready'));
    assertHintOwnership();
    expect(hintWrites).toHaveLength(settledHintWrites); // zero extra writes for the settled target
    expect(editor()).toBe(input);
    expect(context.api.getPublicInstance!('query')).toBe(instance);
    context.api.call('command', 'setInputValue', '', false);
    await vi.waitFor(() => expect(context.refs.results.textContent).toContain('PagesHomeDocs'));
    expect(editor()).toBe(input);
    assertHintOwnership();
    expect(hintWrites).toHaveLength(settledHintWrites);
    context.api.call('command', 'select', session.read().navigation[1]!.id);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/en/start-here/what-you-saw/'));
    expect(session.read().open).toBe(false);
    expect(errors).toEqual([]);
  });
}

/** Deliberately delayed public author-slot commits, not native timing evidence. */
function controlledHintFixture() {
  const session = createSiteSearchSession({
    origin: 'https://docs.test',
    navigate: vi.fn(),
    navigation: [{ title: 'Home', href: '/en/' }],
    load: async () => ({ search: async () => ({ results: [] }) }),
  });
  const errors: unknown[] = [];
  const pending: Array<{ resolve(value: DemoChildrenCommit): void; reject(error: unknown): void }> =
    [];
  let resultWrites = 0;
  const command = { getExposes: () => ({}) };
  const refs = {
    status: document.createElement('div'),
    results: document.createElement('div'),
    'keyboard-hint': document.createElement('div'),
  };
  const composition = createSiteSearchComposition({
    family: 'brutalist',
    shadcnStyle: 'rhea',
    session,
    copy,
    isCurrent: () => true,
    onFailure: (error) => errors.push(error),
  });
  const cleanup = composition.demo.setup!({
    host: document.createElement('div'),
    refs,
    api: {
      getPublicInstance: (ref) => (ref === 'command' ? command : undefined),
      subscribePublicInstances: () => () => {},
      setProps() {},
      getExposes() {
        return undefined;
      },
      call() {},
      setChildren(ref) {
        if (ref !== 'keyboard-hint') {
          if (ref === 'results') resultWrites++;
          return Promise.resolve<DemoChildrenCommit>('committed');
        }
        return new Promise<DemoChildrenCommit>((resolve, reject) =>
          pending.push({ resolve, reject })
        );
      },
    },
  });
  cleanups.push(async () => {
    try {
      if (typeof cleanup === 'function') await cleanup();
    } finally {
      session.dispose();
    }
  });
  return { session, refs, pending, errors, resultWrites: () => resultWrites };
}

it('hint commit control: results proceed independently and stable success writes the hint once', async () => {
  const f = controlledHintFixture();
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.resultWrites()).toBeGreaterThan(0));
  expect(f.pending).toHaveLength(1); // unresolved hint does not gate actual result commits
  f.pending[0]!.resolve('committed');
  await Promise.resolve();
  f.session.input('a', false);
  f.session.input('ab', false);
  await vi.waitFor(() => expect(f.session.read().snapshot.phase).toBe('empty'));
  expect(f.pending).toHaveLength(1);
  expect(f.errors).toEqual([]);
});
it('hint commit control: superseded and disposed outcomes permit later real paints without a retry loop', async () => {
  const f = controlledHintFixture();
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.session.read().snapshot.phase).toBe('idle'));
  expect(f.pending).toHaveLength(1);
  f.pending[0]!.resolve('superseded');
  await Promise.resolve();
  expect(f.pending).toHaveLength(1);
  f.session.input('a', false);
  await vi.waitFor(() => expect(f.pending).toHaveLength(2));
  await vi.waitFor(() => expect(f.session.read().snapshot.phase).toBe('empty'));
  f.pending[1]!.resolve('disposed');
  await Promise.resolve();
  expect(f.pending).toHaveLength(2);
  f.session.input('b', false);
  await vi.waitFor(() => expect(f.pending).toHaveLength(3));
  f.pending[2]!.resolve('committed');
  expect(f.errors).toEqual([]);
});
it('hint commit control: close/reopen and target replacement reject old completion credit', async () => {
  const f = controlledHintFixture();
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.session.read().snapshot.phase).toBe('idle'));
  expect(f.pending).toHaveLength(1);
  f.session.setOpen(false);
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.pending).toHaveLength(2));
  f.pending[0]!.resolve('committed');
  await Promise.resolve();
  f.refs['keyboard-hint'] = document.createElement('div');
  f.session.input('new-target', false);
  await vi.waitFor(() => expect(f.pending).toHaveLength(3));
  f.pending[1]!.resolve('committed');
  await Promise.resolve();
  f.pending[2]!.resolve('disposed');
  await Promise.resolve();
  f.session.input('next-real-paint', false);
  await vi.waitFor(() => expect(f.pending).toHaveLength(4));
  f.pending[3]!.resolve('committed');
  expect(f.errors).toEqual([]);
});
it('hint commit control: failure is reported and does not poison the same live target cache', async () => {
  const f = controlledHintFixture();
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.session.read().snapshot.phase).toBe('idle'));
  expect(f.pending).toHaveLength(1);
  const failure = new Error('controlled author-slot rejection');
  f.pending[0]!.reject(failure);
  await vi.waitFor(() => expect(f.errors).toEqual([failure]));
  expect(f.pending).toHaveLength(1);
  f.session.input('next-real-paint', false);
  await vi.waitFor(() => expect(f.pending).toHaveLength(2));
  f.pending[1]!.resolve('committed');
});

/** Public instance readiness precedes author-box commit; this ordering is deliberate. */
function resultsCommitFixture(
  options: { hintReady?: boolean; hintOutcome?: DemoChildrenCommit } = {}
) {
  const session = createSiteSearchSession({
    origin: 'https://docs.test',
    navigate: vi.fn(),
    navigation: [{ title: 'Home', href: '/en/' }],
    load: async () => ({ search: async () => ({ results: [] }) }),
  });
  const errors: unknown[] = [];
  const pending: Array<(value: DemoChildrenCommit) => void> = [];
  const refs: Record<string, HTMLElement> = { status: document.createElement('div') };
  if (options.hintReady !== false) refs['keyboard-hint'] = document.createElement('div');
  const hintTargets: Array<HTMLElement | undefined> = [];
  const command = { getExposes: () => ({}) };
  const composition = createSiteSearchComposition({
    family: 'brutalist',
    shadcnStyle: 'rhea',
    session,
    copy: { ...copy, pages: 'Pages', results: 'Results' },
    isCurrent: () => true,
    onFailure: (error) => errors.push(error),
  });
  const cleanup = composition.demo.setup!({
    host: document.createElement('div'),
    refs,
    api: {
      getPublicInstance: (ref) => (ref === 'command' ? command : undefined),
      subscribePublicInstances: () => () => {},
      setProps() {},
      getExposes() {
        return undefined;
      },
      call() {},
      setChildren(ref) {
        if (ref === 'keyboard-hint') hintTargets.push(refs['keyboard-hint']);
        return ref === 'results'
          ? new Promise<DemoChildrenCommit>((resolve) => pending.push(resolve))
          : Promise.resolve<DemoChildrenCommit>(
              ref === 'keyboard-hint' ? (options.hintOutcome ?? 'committed') : 'committed'
            );
      },
    },
  });
  cleanups.push(async () => {
    try {
      if (typeof cleanup === 'function') await cleanup();
    } finally {
      session.dispose();
    }
  });
  return { session, refs, errors, pending, hintTargets };
}
it('results author-box commit: public instance before author ref waits for the current commit', async () => {
  const f = resultsCommitFixture();
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.session.read().snapshot.phase).toBe('idle'));
  expect(f.pending.length).toBeGreaterThan(0);
  expect(f.errors).toEqual([]);
  const current = document.createElement('div');
  f.refs.results = current;
  for (const resolve of f.pending.splice(0)) resolve('committed');
  await vi.waitFor(() => expect(current.getAttribute('aria-label')).toBe('Pages'));
  expect(f.errors).toEqual([]);
});
it('results author-box commit: close rejects late committed attributes on a replacement target', async () => {
  const f = resultsCommitFixture();
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.session.read().snapshot.phase).toBe('idle'));
  expect(f.pending.length).toBeGreaterThan(0);
  expect(f.errors).toEqual([]);
  f.session.setOpen(false);
  const replacement = document.createElement('div');
  replacement.setAttribute('aria-label', 'new owner');
  const attributes = vi.spyOn(replacement, 'setAttribute');
  f.refs.results = replacement;
  for (const resolve of f.pending.splice(0)) resolve('committed');
  await Promise.resolve();
  await Promise.resolve();
  expect(attributes).not.toHaveBeenCalled();
  expect(replacement.getAttribute('aria-label')).toBe('new owner');
  expect(f.errors).toEqual([]);
});
it('results author-box commit: current open committed results without a box fails explicitly', async () => {
  const f = resultsCommitFixture();
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.session.read().snapshot.phase).toBe('idle'));
  expect(f.pending.length).toBeGreaterThan(0);
  expect(f.errors).toEqual([]);
  for (const resolve of f.pending.splice(0)) resolve('committed');
  await vi.waitFor(() => expect(f.errors).toHaveLength(1));
  expect(f.errors[0]).toBeInstanceOf(Error);
  expect((f.errors[0] as Error).message).toBe(
    'Search committed results without its current author box'
  );
});

it('hint author-box commit: an absent physical target is deferred until the current result commit', async () => {
  const f = resultsCommitFixture({ hintReady: false });
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.pending.length).toBeGreaterThan(0));
  expect(f.hintTargets).toEqual([]);
  expect(f.errors).toEqual([]);
  f.refs.results = document.createElement('div');
  const target = document.createElement('div');
  f.refs['keyboard-hint'] = target;
  for (const resolve of f.pending.splice(0)) resolve('committed');
  await vi.waitFor(() => expect(f.refs.results.getAttribute('aria-label')).toBe('Pages'));
  expect(f.hintTargets).toEqual([target]);
  expect(f.errors).toEqual([]);
});
it('hint author-box commit: close prevents a late result commit from writing a newly published target', async () => {
  const f = resultsCommitFixture({ hintReady: false });
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.pending.length).toBeGreaterThan(0));
  expect(f.hintTargets).toEqual([]);
  f.session.setOpen(false);
  f.refs.results = document.createElement('div');
  f.refs['keyboard-hint'] = document.createElement('div');
  for (const resolve of f.pending.splice(0)) resolve('committed');
  await Promise.resolve();
  await Promise.resolve();
  expect(f.hintTargets).toEqual([]);
  expect(f.errors).toEqual([]);
});
it('hint author-box commit: a current open ready result without its hint box fails explicitly', async () => {
  const f = resultsCommitFixture({ hintReady: false });
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.pending.length).toBeGreaterThan(0));
  f.refs.results = document.createElement('div');
  for (const resolve of f.pending.splice(0)) resolve('committed');
  await vi.waitFor(() => expect(f.errors).toHaveLength(1));
  expect(f.hintTargets).toEqual([]);
  expect(f.errors[0]).toBeInstanceOf(Error);
  expect((f.errors[0] as Error).message).toBe(
    'Search committed results without its current keyboard hint author box'
  );
});

it('hint author-box commit: a physical replacement receives its own current hint at result commit', async () => {
  const f = resultsCommitFixture();
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.pending.length).toBeGreaterThan(0));
  const prepared = f.refs['keyboard-hint'];
  expect(f.hintTargets).toEqual([prepared]);
  const replacement = document.createElement('div');
  f.refs['keyboard-hint'] = replacement;
  f.refs.results = document.createElement('div');
  for (const resolve of f.pending.splice(0)) resolve('committed');
  await vi.waitFor(() => expect(f.refs.results.getAttribute('aria-label')).toBe('Pages'));
  expect(f.hintTargets).toEqual([prepared, replacement]);
  expect(f.errors).toEqual([]);
});
it('hint author-box commit: a noncommitted hint is not retried inside the same result paint', async () => {
  const f = resultsCommitFixture({ hintOutcome: 'superseded' });
  f.session.setOpen(true);
  await vi.waitFor(() => expect(f.session.read().snapshot.phase).toBe('idle'));
  expect(f.pending.length).toBeGreaterThan(0);
  const target = f.refs['keyboard-hint'];
  const beforeCommit = f.hintTargets.length;
  expect(beforeCommit).toBeGreaterThan(0);
  expect(f.hintTargets.every((node) => node === target)).toBe(true);
  f.refs.results = document.createElement('div');
  for (const resolve of f.pending.splice(0)) resolve('committed');
  await vi.waitFor(() => expect(f.refs.results.getAttribute('aria-label')).toBe('Pages'));
  expect(f.hintTargets).toHaveLength(beforeCommit);
  expect(f.errors).toEqual([]);
  f.session.input('later-paint', false);
  await vi.waitFor(() => expect(f.hintTargets.length).toBeGreaterThan(beforeCommit));
  expect(f.hintTargets.every((node) => node === target)).toBe(true);
});
