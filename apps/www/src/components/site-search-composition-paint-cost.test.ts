import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StateSubscribeCallback } from '@proto.ui/core';
import type {
  DemoChildrenCommit,
  DemoKeyedChild,
  DemoPublicInstance,
  DemoPublicInstancesListener,
  DemoRuntimeApi,
} from './PrototypePreviewer/demo-types';
import { createDemoPublicInstances } from './PrototypePreviewer/demo-public-instances';
import { createSiteSearchComposition, type SiteSearchCopy } from './site-search-composition';
import type { SiteSearchRow, SiteSearchSnapshot } from './site-search-data';
import type { SiteSearchSession } from './site-search-session';

const copy: SiteSearchCopy = {
  title: 'Search',
  description: 'Search documents',
  placeholder: 'Query',
  hint: 'Type a query',
  loading: 'Loading',
  empty: 'No results',
  error: 'Unavailable',
  retry: 'Retry',
  more: 'More',
  close: 'Close',
  pages: 'Pages',
  results: 'Results',
  count: (n) => `${n} documents`,
};
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const stop of cleanups.splice(0).reverse()) stop();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function control() {
  let terminal = false;
  const fact = () => {
    let value = false;
    const listeners = new Set<StateSubscribeCallback<boolean>>();
    const history: Array<StateSubscribeCallback<boolean>> = [];
    return {
      get: vi.fn(() => value),
      subscribe: vi.fn((listener: StateSubscribeCallback<boolean>) => {
        listeners.add(listener);
        history.push(listener);
        return () => listeners.delete(listener);
      }),
      set(next: boolean) {
        const prev = value;
        value = next;
        for (const listener of [...listeners]) listener({ type: 'next', prev, next });
      },
      listeners,
      history,
    };
  };
  const focusVisible = fact(),
    disabled = fact(),
    focused = fact();
  return {
    focusVisible,
    disabled,
    focused,
    getExposes: vi.fn(() => {
      if (terminal) throw new Error('read of a terminal public control');
      return { focusVisible, disabled, focused };
    }),
    disconnect() {
      terminal = true;
      for (const field of [disabled, focusVisible, focused])
        for (const listener of [...field.listeners])
          listener({ type: 'disconnect', reason: 'unmount' });
    },
  };
}
const instance = (): DemoPublicInstance => ({ getExposes: () => ({}) });

/** Real composition and InputShell binding; deterministic public commit boundaries,
 * not a native renderer cost or timing oracle. Session reads copy rows/navigation. */
function fixture(family: 'shadcn' | 'brutalist' = 'brutalist', batchedPublications = false) {
  const listeners = new Set<() => void>();
  const state: {
    open: boolean;
    retrying: boolean;
    snapshot: SiteSearchSnapshot;
    navigation: SiteSearchRow[];
  } = {
    open: false,
    retrying: false,
    navigation: [],
    snapshot: {
      query: 'button',
      phase: 'ready',
      rows: [{ id: 'one', title: 'Button', href: '/button' }],
      resultCount: 2,
      hasMore: true,
      loadingMore: false,
      moreError: false,
    },
  };
  const publish = () => {
    for (const listener of [...listeners]) listener();
  };
  const session: SiteSearchSession = {
    read: () => ({
      ...state,
      snapshot: { ...state.snapshot, rows: state.snapshot.rows.map((row) => ({ ...row })) },
      navigation: state.navigation.map((row) => ({ ...row })),
    }),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setOpen(open) {
      if (open !== state.open) {
        state.open = open;
        publish();
      }
    },
    input(query) {
      state.snapshot = { ...state.snapshot, query };
      publish();
    },
    execute: vi.fn(() => true),
    retry: vi.fn(),
    loadMore: vi.fn(),
    dispose() {
      listeners.clear();
    },
  };
  const source = control();
  const owners: Record<string, DemoPublicInstance | undefined> = {
    dialog: instance(),
    command: instance(),
    panel: { getExposes: () => ({ isPresent: { get: () => true } }) },
    close: instance(),
    'query-shell': family === 'shadcn' ? instance() : undefined,
    query: source,
  };
  const refs: Record<string, HTMLElement> = Object.fromEntries(
    ['results', 'actions', 'status', 'keyboard-hint', 'panel'].map((name) => [
      name,
      document.createElement('div'),
    ])
  );
  const errors: unknown[] = [];
  let notify: DemoPublicInstancesListener = () => {};
  let focusEpoch = 0;
  let revision = 0,
    live = true,
    disposed = false;
  // The existing synchronous fixture remains unchanged by default. Ordering
  // controls opt into the same identity publisher used by all built-in hosts.
  const publications = batchedPublications
    ? createDemoPublicInstances({
        read: (ref) => owners[ref],
        current: () => live,
        fail(error) {
          throw error;
        },
      })
    : undefined;
  let actionKey: string | undefined;
  const delayed = new Set<string>();
  type Commit = {
    ref: string;
    children: readonly DemoKeyedChild[];
    resolve(outcome: DemoChildrenCommit): void;
    reject(error: unknown): void;
  };
  const pending: Commit[] = [];
  const hooks: {
    props?: (ref: string, props: Record<string, unknown>) => void;
    children?: (ref: string) => void;
  } = {};
  const api: DemoRuntimeApi = {
    getPublicInstance: (ref) => owners[ref],
    subscribePublicInstances(names, listener) {
      if (publications) return publications.subscribe(names, listener);
      notify = listener;
      listener({ ...owners }, revision);
      return () => {
        notify = () => {};
      };
    },
    getExposes: (ref) => owners[ref]?.getExposes(),
    call: vi.fn(),
    setProps: vi.fn((ref, props) => {
      hooks.props?.(ref, props);
    }),
    setChildren: vi.fn((ref, children) => {
      const apply = (outcome: DemoChildrenCommit) => {
        if (outcome === 'committed' && ref === 'actions') {
          const next = children[0]?.key;
          if (next !== actionKey) {
            actionKey = next;
            owners['search-page-action'] = next ? instance() : undefined;
          }
        }
        return outcome;
      };
      let result: Promise<DemoChildrenCommit>;
      if (delayed.has(ref))
        result = new Promise((resolve, reject) => {
          pending.push({ ref, children, resolve: (value) => resolve(apply(value)), reject });
        });
      else result = Promise.resolve(apply('committed'));
      hooks.children?.(ref);
      return result;
    }),
  };
  const composition = createSiteSearchComposition({
    family,
    shadcnStyle: 'rhea',
    session,
    copy,
    isCurrent: () => live,
    onFailure: (error) => errors.push(error),
    takeFocusRestore: () => null,
    focusEpoch: () => focusEpoch,
  });
  const stop = composition.demo.setup!({ api, refs, host: document.createElement('div') });
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    live = false;
    if (typeof stop === 'function') stop();
    publications?.retire();
    session.dispose();
  };
  cleanups.push(destroy);
  return {
    state,
    session,
    api,
    refs,
    owners,
    errors,
    delayed,
    pending,
    hooks,
    source,
    setFocusEpoch(epoch: number) {
      focusEpoch = epoch;
    },
    destroy,
    open() {
      session.setOpen(true);
    },
    paint() {
      composition.activate();
    },
    update(snapshot: Partial<SiteSearchSnapshot>) {
      state.snapshot = { ...state.snapshot, ...snapshot };
      publish();
    },
    identities(patch: Record<string, DemoPublicInstance | undefined>) {
      Object.assign(owners, patch);
      if (publications) publications.schedule();
      else notify({ ...owners }, ++revision);
    },
    writes(ref: string) {
      return vi.mocked(api.setChildren!).mock.calls.filter(([name]) => name === ref);
    },
    props(ref: string) {
      return vi
        .mocked(api.setProps)
        .mock.calls.filter(([name]) => name === ref)
        .map(([, props]) => props);
    },
    clear() {
      vi.mocked(api.setChildren!).mockClear();
      vi.mocked(api.setProps).mockClear();
    },
  };
}
async function settled() {
  for (let i = 0; i < 16; i++) await Promise.resolve();
}

describe('Search composition repeated publications', () => {
  it('does not re-submit unchanged open, results, actions or current action callback', async () => {
    const f = fixture();
    f.open();
    await settled();
    f.clear();
    for (let i = 0; i < 3; i++) {
      f.paint();
      await settled();
    }
    expect(f.props('dialog').filter((props) => 'open' in props)).toEqual([]);
    expect(f.writes('results')).toEqual([]);
    expect(f.writes('actions')).toEqual([]);
    expect(f.props('search-page-action')).toEqual([]);
    expect(f.errors).toEqual([]);
  });

  it('updates status without another unchanged author tree or callback', async () => {
    const f = fixture();
    f.open();
    await settled();
    f.clear();
    f.update({ resultCount: 37 });
    await settled();
    expect(f.refs.status.textContent).toBe('37 documents');
    expect(f.writes('results')).toEqual([]);
    expect(f.writes('actions')).toEqual([]);
    expect(f.props('search-page-action')).toEqual([]);
  });

  it('shares a pending identical result while the latest paint still finishes status/actions', async () => {
    const f = fixture();
    f.delayed.add('results');
    f.open();
    f.paint();
    f.paint();
    expect(f.pending.filter((c) => c.ref === 'results')).toHaveLength(1);
    f.pending[0].resolve('committed');
    await settled();
    expect(f.refs.status.textContent).toBe('2 documents');
    expect(f.writes('actions')).toHaveLength(1);
  });

  it('reserves a pending publication before a synchronous public identity notification', async () => {
    const f = fixture();
    let once = true;
    f.hooks.children = (ref) => {
      if (ref === 'results' && once) {
        once = false;
        f.identities({ panel: instance() });
      }
    };
    f.open();
    await settled();
    expect(f.writes('results')).toHaveLength(1);
    expect(f.refs.status.textContent).toBe('2 documents');
    expect(f.writes('actions')).toHaveLength(1);
    expect(f.errors).toEqual([]);
  });

  it('publishes every changed authored result value, order and empty/navigation shape', async () => {
    const f = fixture();
    f.open();
    await settled();
    f.clear();
    for (const rows of [
      [{ id: 'one', title: 'Renamed', href: '/button' }],
      [{ id: 'one', title: 'Renamed', href: '/renamed' }],
      [
        { id: 'one', title: 'Renamed', href: '/renamed' },
        { id: 'two', title: 'Two', href: '/two' },
      ],
      [
        { id: 'two', title: 'Two', href: '/two' },
        { id: 'one', title: 'Renamed', href: '/renamed' },
      ],
    ]) {
      f.update({ rows });
      await settled();
    }
    expect(f.writes('results')).toHaveLength(4);
    expect(JSON.stringify(f.writes('results').at(-1)?.[1])).toContain('/renamed');
    f.update({ phase: 'empty', rows: [] });
    await settled();
    expect(JSON.stringify(f.writes('results').at(-1)?.[1])).toContain('No results');
    f.state.navigation = [{ id: 'nav', title: 'Home', href: '/' }];
    f.update({ query: '' });
    await settled();
    expect(JSON.stringify(f.writes('results').at(-1)?.[1])).toContain('Home');
    expect(f.refs.results.getAttribute('aria-label')).toBe('Pages');
  });

  it('publishes changed action kind, loading text and disabled state while retaining rows', async () => {
    const f = fixture();
    f.open();
    await settled();
    f.clear();
    f.update({ loadingMore: true });
    await settled();
    expect(f.writes('actions')).toHaveLength(1);
    expect(JSON.stringify(f.writes('actions')[0][1])).toContain('Loading');
    expect(JSON.stringify(f.writes('actions')[0][1])).toContain('"disabled":true');
    f.update({ loadingMore: false, moreError: true });
    await settled();
    expect(f.writes('actions')).toHaveLength(2);
    expect(JSON.stringify(f.writes('actions')[1][1])).toContain('Retry');
    expect(f.writes('results')).toEqual([]);
  });

  it('overrides pending B when content returns to formerly committed A', async () => {
    const f = fixture();
    f.open();
    await settled();
    f.clear();
    f.delayed.add('results');
    const original = f.state.snapshot.rows;
    f.update({ rows: [{ id: 'two', title: 'B', href: '/b' }] });
    f.update({ rows: original });
    expect(f.pending).toHaveLength(2);
    f.pending[0].resolve('committed');
    await settled();
    expect(f.writes('actions')).toEqual([]);
    f.pending[1].resolve('committed');
    await settled();
    f.paint();
    await settled();
    expect(f.pending).toHaveLength(2);
    expect(f.refs.results.getAttribute('aria-label')).toBe('Results');
  });

  for (const outcome of ['superseded', 'disposed', 'rejected'] as const) {
    it(`does not cache ${outcome} results or retry them before a later real paint`, async () => {
      const f = fixture();
      f.delayed.add('results');
      f.open();
      const failure = new Error('controlled commit failure');
      if (outcome === 'rejected') f.pending[0].reject(failure);
      else f.pending[0].resolve(outcome);
      await settled();
      expect(f.pending).toHaveLength(1);
      f.paint();
      expect(f.pending).toHaveLength(2);
      f.pending[1].resolve('committed');
      await settled();
      expect(f.refs.status.textContent).toBe('2 documents');
      expect(f.errors).toEqual(outcome === 'rejected' ? [failure] : []);
    });
  }

  it('invalidates the exact Command, result box and action box identities independently', async () => {
    const f = fixture();
    f.open();
    await settled();
    f.clear();
    f.refs.results = document.createElement('div');
    f.paint();
    await settled();
    expect(f.writes('results')).toHaveLength(1);
    expect(f.writes('actions')).toHaveLength(0);
    f.clear();
    f.refs.actions = document.createElement('div');
    f.paint();
    await settled();
    expect(f.writes('results')).toHaveLength(0);
    expect(f.writes('actions')).toHaveLength(1);
    f.clear();
    f.identities({ command: instance() });
    await settled();
    expect(f.writes('results')).toHaveLength(1);
    expect(f.writes('actions')).toHaveLength(1);
  });

  it('does not let a closed lifetime acknowledge a reopened publication', async () => {
    const f = fixture();
    f.delayed.add('results');
    f.open();
    f.session.setOpen(false);
    f.session.setOpen(true);
    expect(f.pending).toHaveLength(2);
    f.pending[0].resolve('committed');
    await settled();
    expect(f.refs.status.textContent).toBe('');
    f.pending[1].resolve('committed');
    await settled();
    f.paint();
    await settled();
    expect(f.pending).toHaveLength(2);
    expect(f.refs.status.textContent).toBe('2 documents');
  });

  it('admits a late first author box only from its successful current acknowledgement', async () => {
    const f = fixture();
    delete f.refs.results;
    f.delayed.add('results');
    f.open();
    expect(f.errors).toEqual([]);
    f.refs.results = document.createElement('div');
    f.pending[0].resolve('committed');
    await settled();
    expect(f.refs.results.getAttribute('aria-label')).toBe('Results');
    f.paint();
    await settled();
    expect(f.pending).toHaveLength(1);
    expect(f.errors).toEqual([]);
  });

  it('replays open for a replaced Dialog and retains synchronous close/reopen intent', async () => {
    const f = fixture();
    f.open();
    await settled();
    f.clear();
    f.identities({ dialog: instance(), panel: instance() });
    await settled();
    expect(f.props('dialog').filter((p) => 'open' in p)).toEqual([{ open: true }]);
    f.session.setOpen(false);
    f.session.setOpen(true);
    await settled();
    expect(f.props('dialog').filter((p) => 'open' in p)).toEqual([
      { open: true },
      { open: false },
      { open: true },
    ]);
  });

  it('retries a failed action callback write without resubmitting committed author trees', async () => {
    const f = fixture();
    const failure = new Error('callback projection failed');
    f.hooks.props = (ref) => {
      if (ref === 'search-page-action') throw failure;
    };
    f.open();
    await settled();
    expect(f.errors).toEqual([failure]);
    expect(f.props('search-page-action')).toHaveLength(1);
    f.hooks.props = undefined;
    f.paint();
    await settled();
    expect(f.props('search-page-action')).toHaveLength(2);
    expect(f.writes('results')).toHaveLength(1);
    expect(f.writes('actions')).toHaveLength(1);
  });

  it('reports a shared pending failure once from the latest paint and permits a later retry', async () => {
    const f = fixture();
    f.delayed.add('results');
    f.open();
    f.paint();
    expect(f.pending).toHaveLength(1);
    const failure = new Error('shared pending failure');
    f.pending[0].reject(failure);
    await settled();
    expect(f.errors).toEqual([failure]);
    f.paint();
    expect(f.pending).toHaveLength(2);
    f.pending[1].resolve('committed');
    await settled();
    expect(f.refs.status.textContent).toBe('2 documents');
  });

  it('retries an unaccepted startup Retry focus when the current panel finishes entering', async () => {
    const f = fixture();
    const transitions = new Set<(event: { type: string; next: string }) => void>();
    let entered = false;
    let actionFocused = false;
    f.identities({
      panel: {
        getExposes: () => ({
          isPresent: { get: () => true },
          transitionState: {
            get: () => (entered ? 'entered' : 'entering'),
            subscribe(listener: (event: { type: string; next: string }) => void) {
              transitions.add(listener);
              return () => transitions.delete(listener);
            },
          },
        }),
      },
    });
    f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
    f.source.focused.set(true);
    vi.mocked(f.api.call).mockImplementation((ref, method) => {
      if (ref !== 'search-page-action' || method !== 'focusSelf') return;
      f.owners[ref]!.getExposes = () => ({ focused: { get: () => actionFocused } });
      if (entered) actionFocused = true;
    });
    f.open();
    f.setFocusEpoch(1); // Only the automatic query entry advanced this opening.
    await settled();
    expect(actionFocused).toBe(false);
    expect(f.api.call).toHaveBeenCalledWith('search-page-action', 'focusSelf');
    entered = true;
    for (const listener of [...transitions]) listener({ type: 'next', next: 'entered' });
    await settled();
    expect(actionFocused).toBe(true);
    const acceptedCalls = vi.mocked(f.api.call).mock.calls.length;
    f.paint();
    await settled();
    expect(vi.mocked(f.api.call).mock.calls.length).toBe(acceptedCalls);
    expect(f.errors).toEqual([]);
  });

  it.each(['shadcn', 'brutalist'] as const)(
    '%s completes a pending Retry when query focus arrives after the last panel transition',
    async (family) => {
      // Real composition; controlled public facts and request acceptance only.
      // This ordering control is not native portal or browser timing evidence.
      const f = fixture(family);
      const transitions = new Set<(event: { type: string; next: string }) => void>();
      let entered = false;
      let entryCompleted = false;
      let actionFocused = false;
      f.identities({
        panel: {
          getExposes: () => ({
            isPresent: { get: () => true },
            transitionState: {
              get: () => (entered ? 'entered' : 'entering'),
              subscribe(listener: (event: { type: string; next: string }) => void) {
                transitions.add(listener);
                return () => transitions.delete(listener);
              },
            },
          }),
        },
      });
      f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
      vi.mocked(f.api.call).mockImplementation((ref, method) => {
        if (ref !== 'search-page-action' || method !== 'focusSelf') return;
        f.owners[ref]!.getExposes = () => ({ focused: { get: () => actionFocused } });
        if (entryCompleted) {
          actionFocused = true;
          f.source.focused.set(false);
          f.setFocusEpoch(2);
        }
      });
      const focusCalls = () =>
        vi
          .mocked(f.api.call)
          .mock.calls.filter(
            ([ref, method]) => ref === 'search-page-action' && method === 'focusSelf'
          );
      f.open();
      await settled();
      expect(focusCalls()).toHaveLength(1);
      expect(actionFocused).toBe(false);
      entered = true;
      for (const listener of [...transitions]) listener({ type: 'next', next: 'entered' });
      await settled();
      expect(focusCalls()).toHaveLength(2);
      expect(actionFocused).toBe(false);
      const action = f.owners['search-page-action'];
      const query = f.owners.query;
      const resultWrites = f.writes('results').length;
      const actionWrites = f.writes('actions').length;

      // The query's existing public fact is the only new publication. Its host
      // event finishes after the fact notification and advances the focus epoch.
      // Do not manually paint, replace an identity, or emit another transition.
      f.source.focused.set(true);
      f.setFocusEpoch(1);
      entryCompleted = true;
      await settled();
      expect(actionFocused).toBe(true);
      expect(focusCalls()).toHaveLength(3);
      expect(f.owners['search-page-action']).toBe(action);
      expect(f.owners.query).toBe(query);
      expect(f.writes('results')).toHaveLength(resultWrites);
      expect(f.writes('actions')).toHaveLength(actionWrites);

      // A later focus choice and duplicate transition cannot repeat a completed handoff.
      f.setFocusEpoch(3);
      f.source.focused.set(true);
      for (const listener of [...transitions]) listener({ type: 'next', next: 'entered' });
      await settled();
      expect(focusCalls()).toHaveLength(3);
      f.destroy();
      expect(transitions.size).toBe(0);
      expect(f.source.focused.listeners.size).toBe(0);
      expect(f.errors).toEqual([]);
    }
  );

  it.each([
    'close',
    'reopen',
    'newer-focus',
    'query-blur',
    'query-replacement',
    'action-replacement',
    'dispose',
    'query-disconnect',
  ] as const)('cancels a queued query-entry wake after %s', async (reason) => {
    const f = fixture();
    f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
    vi.mocked(f.api.call).mockImplementation((ref, method) => {
      if (ref === 'search-page-action' && method === 'focusSelf')
        f.owners[ref]!.getExposes = () => ({ focused: { get: () => false } });
    });
    const focusCalls = () =>
      vi
        .mocked(f.api.call)
        .mock.calls.filter(
          ([ref, method]) => ref === 'search-page-action' && method === 'focusSelf'
        );
    f.open();
    await settled();
    expect(focusCalls()).toHaveLength(1);
    f.source.focused.set(true);
    f.setFocusEpoch(1);
    const replacement = control();
    replacement.focused.set(true);
    if (reason === 'close') f.session.setOpen(false);
    if (reason === 'reopen') {
      f.session.setOpen(false);
      f.state.snapshot = { ...f.state.snapshot, phase: 'loading' };
      f.session.setOpen(true);
    }
    if (reason === 'newer-focus') f.setFocusEpoch(2);
    if (reason === 'query-blur') f.source.focused.set(false);
    // A host owner can be replaced before its coalesced identity notification.
    // No fresh paint is manufactured to help the old queued request.
    if (reason === 'query-replacement') f.owners.query = replacement;
    if (reason === 'action-replacement') f.owners['search-page-action'] = instance();
    if (reason === 'dispose') f.destroy();
    if (reason === 'query-disconnect') {
      for (const listener of [...f.source.focused.listeners])
        listener({ type: 'disconnect', reason: 'unmount' });
    }
    const factReads = f.source.focused.get.mock.calls.length;
    await settled();
    expect(focusCalls()).toHaveLength(1);
    if (!['newer-focus', 'query-blur'].includes(reason))
      expect(f.source.focused.get).toHaveBeenCalledTimes(factReads);
    if (reason === 'query-replacement') {
      f.state.snapshot = { ...f.state.snapshot, phase: 'loading' };
      f.identities({ query: replacement });
      await settled();
      expect(f.source.focused.listeners.size).toBe(0);
      expect(replacement.focused.listeners.size).toBe(1);
    }
    f.destroy();
    expect(f.source.focused.listeners.size).toBe(0);
    expect(replacement.focused.listeners.size).toBe(0);
    expect(f.errors).toEqual([]);
  });

  it('coalesces duplicate query focus facts into one wake while retaining later real paints', async () => {
    const f = fixture();
    f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
    vi.mocked(f.api.call).mockImplementation((ref, method) => {
      if (ref === 'search-page-action' && method === 'focusSelf')
        f.owners[ref]!.getExposes = () => ({ focused: { get: () => false } });
    });
    const focusCalls = () =>
      vi
        .mocked(f.api.call)
        .mock.calls.filter(
          ([ref, method]) => ref === 'search-page-action' && method === 'focusSelf'
        );
    f.open();
    await settled();
    expect(focusCalls()).toHaveLength(1);
    for (let i = 0; i < 3; i++) f.source.focused.set(true);
    f.setFocusEpoch(1);
    await settled();
    expect(focusCalls()).toHaveLength(2);
    for (let i = 0; i < 3; i++) f.source.focused.set(true);
    await settled();
    expect(focusCalls()).toHaveLength(2);
    // Consuming the query-entry wake does not certify a refused focus call.
    f.paint();
    await settled();
    expect(focusCalls()).toHaveLength(3);
    f.destroy();
    expect(f.source.focused.listeners.size).toBe(0);
    expect(f.errors).toEqual([]);
  });

  it('retains the panel transition path when query entry arrives during preparation', async () => {
    const f = fixture();
    const transitions = new Set<(event: { type: string; next: string }) => void>();
    let present = false;
    let actionFocused = false;
    f.identities({
      panel: {
        getExposes: () => ({
          isPresent: { get: () => present },
          transitionState: {
            get: () => (present ? 'entered' : 'entering'),
            subscribe(listener: (event: { type: string; next: string }) => void) {
              transitions.add(listener);
              return () => transitions.delete(listener);
            },
          },
        }),
      },
    });
    f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
    vi.mocked(f.api.call).mockImplementation((ref, method) => {
      if (ref !== 'search-page-action' || method !== 'focusSelf') return;
      actionFocused = true;
      f.owners[ref]!.getExposes = () => ({ focused: { get: () => actionFocused } });
      f.source.focused.set(false);
      f.setFocusEpoch(2);
    });
    const focusCalls = () =>
      vi
        .mocked(f.api.call)
        .mock.calls.filter(
          ([ref, method]) => ref === 'search-page-action' && method === 'focusSelf'
        );
    f.open();
    await settled();
    f.source.focused.set(true);
    f.setFocusEpoch(1);
    await settled();
    expect(focusCalls()).toHaveLength(0);
    present = true;
    for (const listener of [...transitions]) listener({ type: 'next', next: 'entered' });
    await settled();
    expect(actionFocused).toBe(true);
    expect(focusCalls()).toHaveLength(1);
    f.destroy();
    expect(transitions.size).toBe(0);
    expect(f.source.focused.listeners.size).toBe(0);
    expect(f.errors).toEqual([]);
  });

  it('retires a synchronously disconnected query subscription without reviving terminal facts', async () => {
    const f = fixture();
    const next = control();
    const off = vi.fn();
    let terminal = false;
    next.getExposes.mockImplementation(() => {
      if (terminal) throw new Error('terminal query facts were read');
      return { focused: next.focused, focusVisible: next.focusVisible, disabled: next.disabled };
    });
    next.focused.subscribe.mockImplementation((listener) => {
      next.focused.listeners.add(listener);
      next.focused.history.push(listener);
      listener({ type: 'disconnect', reason: 'unmount' });
      terminal = true;
      return () => {
        next.focused.listeners.delete(listener);
        off();
        return true;
      };
    });
    f.identities({ query: next });
    await settled();
    expect(off).toHaveBeenCalledTimes(1);
    expect(next.focused.listeners.size).toBe(0);
    const reads = next.getExposes.mock.calls.length;
    f.identities({ panel: instance() });
    for (const listener of next.focused.history)
      listener({ type: 'next', prev: false, next: true });
    await settled();
    expect(next.getExposes).toHaveBeenCalledTimes(reads);
    f.destroy();
    expect(off).toHaveBeenCalledTimes(1);
    expect(f.errors).toEqual([]);
  });

  it.each(['subscribe', 'unsubscribe'] as const)(
    'keeps only the newest query binding when %s reenters identity publication',
    async (boundary) => {
      const f = fixture();
      const first = control();
      const intermediate = control();
      const newest = control();
      const originalSubscribe = first.focused.subscribe.getMockImplementation()!;
      first.focused.subscribe.mockImplementation((listener) => {
        const off = originalSubscribe(listener);
        if (boundary === 'subscribe') f.identities({ query: newest });
        return () => {
          const removed = off();
          if (boundary === 'unsubscribe') f.identities({ query: newest });
          return removed;
        };
      });
      f.identities({ query: first });
      if (boundary === 'unsubscribe') f.identities({ query: intermediate });
      await settled();
      expect(f.owners.query).toBe(newest);
      expect(first.focused.listeners.size).toBe(0);
      expect(intermediate.focused.subscribe).not.toHaveBeenCalled();
      expect(newest.focused.subscribe).toHaveBeenCalledTimes(1);
      expect(newest.focused.listeners.size).toBe(1);
      f.destroy();
      expect(newest.focused.listeners.size).toBe(0);
      expect(f.errors).toEqual([]);
    }
  );

  it.each(['subscribe', 'unsubscribe'] as const)(
    'preserves the newest Shadcn InputShell facts when query %s reenters',
    async (boundary) => {
      const f = fixture('shadcn');
      const first = control();
      const intermediate = control();
      const newest = control();
      const originalSubscribe = first.focused.subscribe.getMockImplementation()!;
      first.focused.subscribe.mockImplementation((listener) => {
        const off = originalSubscribe(listener);
        if (boundary === 'subscribe') f.identities({ query: newest });
        return () => {
          const removed = off();
          if (boundary === 'unsubscribe') f.identities({ query: newest });
          return removed;
        };
      });
      f.identities({ query: first });
      if (boundary === 'unsubscribe') f.identities({ query: intermediate });
      await settled();
      expect(f.owners.query).toBe(newest);
      expect(first.focused.listeners.size).toBe(0);
      expect(first.focusVisible.listeners.size).toBe(0);
      expect(first.disabled.listeners.size).toBe(0);
      expect(intermediate.getExposes).not.toHaveBeenCalled();
      expect(newest.focused.listeners.size).toBe(1);
      expect(newest.focusVisible.listeners.size).toBe(1);
      expect(newest.disabled.listeners.size).toBe(1);
      newest.focusVisible.set(true);
      newest.disabled.set(true);
      expect(f.props('query-shell').at(-1)).toEqual({
        focusVisible: true,
        disabled: true,
      });
      f.destroy();
      expect(newest.focused.listeners.size).toBe(0);
      expect(newest.focusVisible.listeners.size).toBe(0);
      expect(newest.disabled.listeners.size).toBe(0);
      expect(f.errors).toEqual([]);
    }
  );

  it.each(['shadcn', 'brutalist'] as const)(
    '%s uses the identity publication paint when its new query is already focused',
    async (family) => {
      const f = fixture(family, true);
      const transitions = new Set<(event: { type: string; next: string }) => void>();
      let entered = false;
      let ready = false;
      let actionFocused = false;
      f.identities({
        panel: {
          getExposes: () => ({
            isPresent: { get: () => true },
            transitionState: {
              get: () => (entered ? 'entered' : 'entering'),
              subscribe(listener: (event: { type: string; next: string }) => void) {
                transitions.add(listener);
                return () => transitions.delete(listener);
              },
            },
          }),
        },
      });
      await settled();
      f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
      vi.mocked(f.api.call).mockImplementation((ref, method) => {
        if (ref !== 'search-page-action' || method !== 'focusSelf') return;
        f.owners[ref]!.getExposes = () => ({ focused: { get: () => actionFocused } });
        if (ready) actionFocused = true;
      });
      const focusCalls = () =>
        vi
          .mocked(f.api.call)
          .mock.calls.filter(
            ([ref, method]) => ref === 'search-page-action' && method === 'focusSelf'
          );
      f.open();
      await settled();
      expect(focusCalls()).toHaveLength(1);
      entered = true;
      for (const listener of [...transitions]) listener({ type: 'next', next: 'entered' });
      await settled();
      expect(focusCalls()).toHaveLength(2);
      expect(actionFocused).toBe(false);
      const action = f.owners['search-page-action'];
      const resultWrites = f.writes('results').length;
      const actionWrites = f.writes('actions').length;
      const next = control();
      // This public fact changes before the identity publisher's microtask.
      // subscribe() does not replay it; there is no later fact or transition.
      next.focused.set(true);
      expect(next.focused.history).toHaveLength(0);
      f.setFocusEpoch(1);
      ready = true;
      f.identities({ query: next });
      expect(actionFocused).toBe(false);
      await settled();
      expect(actionFocused).toBe(true);
      expect(focusCalls()).toHaveLength(3);
      expect(f.owners['search-page-action']).toBe(action);
      expect(f.owners.query).toBe(next);
      expect(f.writes('results')).toHaveLength(resultWrites);
      expect(f.writes('actions')).toHaveLength(actionWrites);
      f.destroy();
      expect(transitions.size).toBe(0);
      expect(next.focused.listeners.size).toBe(0);
      expect(next.focusVisible.listeners.size).toBe(0);
      expect(next.disabled.listeners.size).toBe(0);
      expect(f.errors).toEqual([]);
    }
  );

  it.each(['shadcn', 'brutalist'] as const)(
    '%s retires a terminal query before binding other facts and accepts a fresh owner',
    async (family) => {
      const f = fixture(family);
      const terminal = control();
      const off = vi.fn();
      let disconnected = false;
      terminal.getExposes.mockImplementation(() => {
        if (disconnected) throw new Error('terminal query facts were read');
        return {
          focused: terminal.focused,
          focusVisible: terminal.focusVisible,
          disabled: terminal.disabled,
        };
      });
      terminal.focused.subscribe.mockImplementation((listener) => {
        terminal.focused.listeners.add(listener);
        terminal.focused.history.push(listener);
        listener({ type: 'disconnect', reason: 'unmount' });
        disconnected = true;
        return () => {
          terminal.focused.listeners.delete(listener);
          off();
          return true;
        };
      });
      expect(() => f.identities({ query: terminal })).not.toThrow();
      await settled();
      expect(off).toHaveBeenCalledTimes(1);
      expect(terminal.focused.listeners.size).toBe(0);
      expect(terminal.focusVisible.subscribe).not.toHaveBeenCalled();
      expect(terminal.disabled.subscribe).not.toHaveBeenCalled();
      expect(f.source.focused.listeners.size).toBe(0);
      expect(f.source.focusVisible.listeners.size).toBe(0);
      expect(f.source.disabled.listeners.size).toBe(0);
      const reads = terminal.getExposes.mock.calls.length;
      expect(() => f.identities({ panel: instance() })).not.toThrow();
      for (const listener of terminal.focused.history)
        listener({ type: 'next', prev: false, next: true });
      await settled();
      expect(terminal.getExposes).toHaveBeenCalledTimes(reads);
      const fresh = control();
      f.identities({ query: fresh });
      await settled();
      expect(fresh.focused.listeners.size).toBe(1);
      if (family === 'shadcn') {
        expect(fresh.focusVisible.listeners.size).toBe(1);
        expect(fresh.disabled.listeners.size).toBe(1);
        fresh.focusVisible.set(true);
        fresh.disabled.set(true);
        expect(f.props('query-shell').at(-1)).toEqual({ focusVisible: true, disabled: true });
      }
      f.destroy();
      expect(fresh.focused.listeners.size).toBe(0);
      expect(fresh.focusVisible.listeners.size).toBe(0);
      expect(fresh.disabled.listeners.size).toBe(0);
      expect(off).toHaveBeenCalledTimes(1);
      expect(f.errors).toEqual([]);
    }
  );

  it('does not certify a refused Retry focus or steal a later focus choice', async () => {
    const f = fixture();
    f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
    f.source.focused.set(true);
    f.open();
    f.setFocusEpoch(1);
    await settled();
    const calls = () =>
      vi
        .mocked(f.api.call)
        .mock.calls.filter(
          ([ref, method]) => ref === 'search-page-action' && method === 'focusSelf'
        ).length;
    expect(calls()).toBe(1);
    // The public control has not confirmed focus; another legitimate paint can retry.
    f.paint();
    await settled();
    expect(calls()).toBe(2);
    // The user left and then returned to the query. Current focus alone is not intent.
    f.setFocusEpoch(3);
    f.paint();
    await settled();
    expect(calls()).toBe(2);
  });

  it.each(['shadcn', 'brutalist'] as const)(
    'retries %s startup failure once when automatic query entry follows the final panel signal',
    async (family) => {
      const f = fixture(family);
      f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
      let actionFocused = false;
      const attempts: boolean[] = [];
      vi.mocked(f.api.call).mockImplementation((ref, method) => {
        if (ref !== 'search-page-action' || method !== 'focusSelf') return;
        f.owners[ref]!.getExposes = () => ({ focused: { get: () => actionFocused } });
        const queryReady = f.source.focused.get();
        attempts.push(queryReady);
        if (queryReady) {
          actionFocused = true;
          f.source.focused.set(false);
        }
      });
      f.open();
      await settled();
      expect(attempts).toEqual([false]);
      expect(actionFocused).toBe(false);
      // The actual input's public focus fact arrives after presentation and
      // both committed slots. No later transition/session/identity paint occurs.
      f.setFocusEpoch(1);
      f.source.focused.set(true);
      f.source.focused.set(true);
      await settled();
      expect(attempts).toEqual([false, true]);
      expect(actionFocused).toBe(true);
      f.source.focused.set(true);
      await settled();
      expect(attempts).toEqual([false, true]);
      expect(f.errors).toEqual([]);
    }
  );

  it.each(['newer focus', 'edited query', 'closed'] as const)(
    'does not hand startup failure focus back after %s before delayed query entry',
    async (changed) => {
      const f = fixture('shadcn');
      f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
      f.open();
      await settled();
      if (changed === 'newer focus') f.setFocusEpoch(3);
      else if (changed === 'edited query') f.update({ query: 'button' });
      else f.session.setOpen(false);
      await settled();
      const before = vi.mocked(f.api.call).mock.calls.length;
      f.source.focused.set(true);
      await settled();
      expect(vi.mocked(f.api.call).mock.calls.length).toBe(before);
      expect(f.errors).toEqual([]);
    }
  );

  it('follows the current query identity and rejects an already-delivering retired focus callback', async () => {
    const f = fixture('shadcn');
    f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
    f.open();
    await settled();
    expect(f.source.focused.listeners.size).toBe(1);
    const stale = f.source.focused.history[0];
    const next = control();
    f.identities({ query: next });
    await settled();
    expect(f.source.focused.listeners.size).toBe(0);
    expect(next.focused.listeners.size).toBe(1);
    f.source.disconnect();
    const attempts = vi.fn();
    vi.mocked(f.api.call).mockImplementation((ref, method) => {
      if (ref !== 'search-page-action' || method !== 'focusSelf') return;
      attempts();
      f.owners[ref]!.getExposes = () => ({ focused: { get: () => true } });
    });
    f.setFocusEpoch(1);
    stale({ type: 'next', prev: false, next: true });
    await settled();
    expect(attempts).not.toHaveBeenCalled();
    next.focused.set(true);
    await settled();
    expect(attempts).toHaveBeenCalledOnce();
    const last = next.focused.history[0];
    f.destroy();
    expect(next.focused.listeners.size).toBe(0);
    next.disconnect();
    last({ type: 'next', prev: false, next: true });
    await settled();
    expect(attempts).toHaveBeenCalledOnce();
    expect(f.errors).toEqual([]);
  });

  it('retires a query focus subscription when its registration synchronously replaces the query', async () => {
    const f = fixture('shadcn');
    const replaced = control();
    const replacement = control();
    const subscribe = replaced.focused.subscribe.getMockImplementation()!;
    replaced.focused.subscribe.mockImplementation((listener) => {
      const stop = subscribe(listener);
      f.identities({ query: replacement });
      return stop;
    });
    f.identities({ query: replaced });
    expect(replaced.focused.subscribe).toHaveBeenCalledOnce();
    expect(replaced.focused.listeners.size).toBe(0);
    expect(replacement.focused.listeners.size).toBe(1);
    const reads = replacement.focused.subscribe.mock.calls.length;
    f.identities({ panel: instance() });
    expect(replacement.focused.subscribe).toHaveBeenCalledTimes(reads);
    f.destroy();
    expect(replacement.focused.listeners.size).toBe(0);
    expect(f.errors).toEqual([]);
  });

  it.each(['dispose', 'disconnect'] as const)(
    'releases a query focus subscription that synchronously triggers %s while registering',
    async (terminal) => {
      const f = fixture('shadcn');
      const next = control();
      const subscribe = next.focused.subscribe.getMockImplementation()!;
      next.focused.subscribe.mockImplementation((listener) => {
        const stop = subscribe(listener);
        if (terminal === 'dispose') f.destroy();
        else next.disconnect();
        return stop;
      });
      f.identities({ query: next });
      expect(next.focused.subscribe).toHaveBeenCalledOnce();
      expect(next.focused.listeners.size).toBe(0);
      const reads = next.getExposes.mock.calls.length;
      const calls = vi.mocked(f.api.call).mock.calls.length;
      expect(() => f.identities({ panel: instance() })).not.toThrow();
      next.focused.history[0]({ type: 'next', prev: false, next: true });
      await settled();
      expect(next.getExposes).toHaveBeenCalledTimes(reads);
      expect(vi.mocked(f.api.call).mock.calls.length).toBe(calls);
      expect(f.errors).toEqual([]);
    }
  );

  it('waits for panel presentation before attempting Retry focus and does not spin after acceptance', async () => {
    const f = fixture();
    const transitions = new Set<(event: { type: string; next: string }) => void>();
    let present = false;
    let actionFocused = false;
    f.identities({
      panel: {
        getExposes: () => ({
          isPresent: { get: () => present },
          transitionState: {
            get: () => (present ? 'entered' : 'entering'),
            subscribe(listener: (event: { type: string; next: string }) => void) {
              transitions.add(listener);
              return () => transitions.delete(listener);
            },
          },
        }),
      },
    });
    f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
    f.source.focused.set(true);
    vi.mocked(f.api.call).mockImplementation((ref, method) => {
      if (ref !== 'search-page-action' || method !== 'focusSelf') return;
      actionFocused = true;
      f.owners[ref]!.getExposes = () => ({ focused: { get: () => actionFocused } });
    });
    const focusCalls = () =>
      vi
        .mocked(f.api.call)
        .mock.calls.filter(
          ([ref, method]) => ref === 'search-page-action' && method === 'focusSelf'
        );
    f.open();
    f.setFocusEpoch(1);
    await settled();
    expect(f.owners['search-page-action']).toBeDefined();
    expect(focusCalls()).toHaveLength(0);
    for (let i = 0; i < 3; i++) {
      f.paint();
      await settled();
    }
    expect(focusCalls()).toHaveLength(0);
    present = true;
    for (const listener of [...transitions]) listener({ type: 'next', next: 'entered' });
    await settled();
    expect(actionFocused).toBe(true);
    expect(focusCalls()).toHaveLength(1);
    for (const listener of [...transitions]) listener({ type: 'next', next: 'entered' });
    f.paint();
    await settled();
    expect(focusCalls()).toHaveLength(1);
    expect(f.errors).toEqual([]);
  });

  it('does not read or bind a terminal Retry after focusSelf synchronously disposes the composition', async () => {
    const f = fixture();
    f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
    const terminalRead = vi.fn(() => {
      throw new Error('terminal Retry control was read');
    });
    vi.mocked(f.api.call).mockImplementation((ref, method) => {
      if (ref !== 'search-page-action' || method !== 'focusSelf') return;
      f.owners[ref]!.getExposes = terminalRead;
      f.destroy();
    });
    f.open();
    await settled();
    expect(terminalRead).not.toHaveBeenCalled();
    expect(f.props('search-page-action')).toEqual([]);
    const calls = vi.mocked(f.api.call).mock.calls.length;
    f.paint();
    await settled();
    expect(vi.mocked(f.api.call).mock.calls.length).toBe(calls);
    expect(f.errors).toEqual([]);
  });

  it('does not certify an old Retry continuation when focusSelf replaces the action and requests a new paint', async () => {
    const f = fixture();
    f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
    let replacementFocused = false;
    const replacement: DemoPublicInstance = {
      getExposes: () => ({ focused: { get: () => replacementFocused } }),
    };
    const focusedOwners: Array<DemoPublicInstance | undefined> = [];
    const boundOwners: Array<DemoPublicInstance | undefined> = [];
    const oldRead = vi.fn(() => {
      throw new Error('replaced Retry control was read');
    });
    f.hooks.props = (ref, props) => {
      if (ref === 'search-page-action' && props.onClick) boundOwners.push(f.owners[ref]);
    };
    vi.mocked(f.api.call).mockImplementation((ref, method) => {
      if (ref !== 'search-page-action' || method !== 'focusSelf') return;
      const owner = f.owners[ref];
      focusedOwners.push(owner);
      if (owner === replacement) {
        replacementFocused = true;
        return;
      }
      owner!.getExposes = oldRead;
      f.owners[ref] = replacement;
      f.paint();
    });
    f.open();
    await settled();
    expect(focusedOwners).toHaveLength(2);
    expect(focusedOwners[0]).not.toBe(replacement);
    expect(focusedOwners[1]).toBe(replacement);
    expect(replacementFocused).toBe(true);
    expect(oldRead).not.toHaveBeenCalled();
    expect(boundOwners).toEqual([replacement]);
    f.paint();
    await settled();
    expect(focusedOwners).toHaveLength(2);
    expect(f.errors).toEqual([]);
  });

  it('does not bind an old action after its focus request synchronously closes the view', async () => {
    const f = fixture();
    f.state.snapshot = { ...f.state.snapshot, query: '', phase: 'error', hasMore: false };
    vi.mocked(f.api.call).mockImplementation((ref, method) => {
      if (ref === 'search-page-action' && method === 'focusSelf') f.session.setOpen(false);
    });
    f.open();
    await settled();
    expect(f.state.open).toBe(false);
    expect(f.props('search-page-action')).toEqual([]);
    expect(f.errors).toEqual([]);
  });

  for (const slot of ['results', 'actions'] as const) {
    it(`admits the ${slot} author box delivered by a fresh successful host commit`, async () => {
      const f = fixture();
      f.delayed.add(slot);
      f.open();
      await settled();
      const prepared = f.refs[slot];
      const committed = document.createElement('div');
      // Framework preparation can publish the new public Command before the
      // physical author-ref index. This successful host/ref commit delivers
      // that current box; the preparing ref is not its committed identity.
      f.refs[slot] = committed;
      f.pending.find((request) => request.ref === slot)!.resolve('committed');
      await settled();
      expect(f.props('search-page-action')).toHaveLength(1);
      expect(f.refs.status.textContent).toBe('2 documents');
      if (slot === 'results') {
        expect(prepared.getAttribute('aria-label')).toBeNull();
        expect(committed.getAttribute('aria-label')).toBe('Results');
      }
      f.paint();
      await settled();
      expect(f.pending.filter((request) => request.ref === slot)).toHaveLength(1);
      expect(f.errors).toEqual([]);
    });

    it(`does not reuse a fresh ${slot} acknowledgement after its committed box changes`, async () => {
      const f = fixture();
      f.delayed.add(slot);
      f.open();
      await settled();
      f.pending.find((request) => request.ref === slot)!.resolve('committed');
      const replacement = document.createElement('div');
      // The acknowledgement continuation runs first; physical replacement is
      // then queued before paint resumes. No new paint certifies this box.
      queueMicrotask(() => {
        f.refs[slot] = replacement;
        if (slot === 'actions') f.owners['search-page-action'] = instance();
      });
      await settled();
      expect(f.props('search-page-action')).toEqual([]);
      if (slot === 'results') expect(replacement.getAttribute('aria-label')).toBeNull();
      expect(f.errors).toEqual([]);
    });
  }

  it('cached author acknowledgement does not admit a result box replaced during await', async () => {
    const f = fixture();
    f.open();
    await settled();
    f.clear();
    f.paint();
    const replacement = document.createElement('div');
    f.refs.results = replacement;
    await settled();
    expect(replacement.getAttribute('aria-label')).toBeNull();
    expect(f.writes('results')).toHaveLength(0);
    f.paint();
    await settled();
    expect(f.writes('results')).toHaveLength(1);
    expect(replacement.getAttribute('aria-label')).toBe('Results');
  });

  it('cached author acknowledgement does not certify a Command replaced during await', async () => {
    const f = fixture();
    f.open();
    await settled();
    f.clear();
    const attributes = vi.spyOn(f.refs.results, 'setAttribute');
    f.paint();
    f.owners.command = instance();
    await settled();
    expect(attributes).not.toHaveBeenCalled();
    f.paint();
    await settled();
    expect(f.writes('results')).toHaveLength(1);
    expect(attributes).toHaveBeenCalledWith('aria-label', 'Results');
  });

  it('cached author acknowledgement does not bind a button in a replacement action box', async () => {
    const f = fixture();
    f.open();
    await settled();
    f.clear();
    f.paint();
    queueMicrotask(() => {
      f.refs.actions = document.createElement('div');
      f.owners['search-page-action'] = instance();
    });
    await settled();
    expect(f.props('search-page-action')).toEqual([]);
    f.paint();
    await settled();
    expect(f.writes('actions')).toHaveLength(1);
    expect(f.props('search-page-action')).toHaveLength(1);
  });
});

describe('Search InputShell actual instance pair', () => {
  it('does not rebind the same pair when only panel or close publishes', async () => {
    const f = fixture('shadcn');
    f.open();
    await settled();
    f.clear();
    const subscribed = f.source.focusVisible.subscribe.mock.calls.length;
    f.identities({ panel: instance() });
    f.identities({ close: instance() });
    await settled();
    expect(f.source.focusVisible.subscribe).toHaveBeenCalledTimes(subscribed);
    expect(f.props('query-shell')).toEqual([]);
    f.source.focusVisible.set(true);
    expect(f.props('query-shell').at(-1)).toEqual({ focusVisible: true, disabled: false });
  });

  it('retires missing/replaced pairs and projects unchanged bools into a new shell', async () => {
    const f = fixture('shadcn');
    f.open();
    await settled();
    f.clear();
    f.identities({ 'query-shell': instance() });
    expect(f.props('query-shell')).toEqual([{ focusVisible: false, disabled: false }]);
    const next = control();
    next.disabled.set(true);
    f.identities({ query: next });
    expect(f.source.disabled.listeners.size).toBe(0);
    expect(next.disabled.listeners.size).toBe(1);
    expect(f.props('query-shell').at(-1)).toEqual({ focusVisible: false, disabled: true });
    f.identities({ query: undefined });
    expect(next.disabled.listeners.size).toBe(0);
    f.identities({ query: control() });
    expect(f.props('query-shell').at(-1)).toEqual({ focusVisible: false, disabled: false });
  });

  it('does not revive terminal facts on an unrelated identity change', async () => {
    const f = fixture('shadcn');
    f.open();
    await settled();
    f.source.disconnect();
    f.clear();
    const reads = f.source.getExposes.mock.calls.length;
    expect(() => f.identities({ panel: instance() })).not.toThrow();
    expect(f.source.getExposes).toHaveBeenCalledTimes(reads);
    expect(f.props('query-shell')).toEqual([]);
    const next = control();
    f.identities({ query: next });
    for (const listener of f.source.disabled.history)
      listener({ type: 'disconnect', reason: 'unmount' });
    next.focusVisible.set(true);
    expect(f.props('query-shell').at(-1)).toEqual({ focusVisible: true, disabled: false });
    expect(next.disabled.listeners.size).toBe(1);
  });

  it('does not retain a binding whose first facts synchronously destroy the owner', async () => {
    const f = fixture('shadcn');
    f.open();
    await settled();
    f.clear();
    const next = control();
    f.hooks.props = (ref) => {
      if (ref === 'query-shell') f.destroy();
    };
    f.identities({ query: next });
    expect(next.focusVisible.listeners.size).toBe(0);
    expect(next.disabled.listeners.size).toBe(0);
    const count = f.props('query-shell').length;
    next.focusVisible.set(true);
    expect(f.props('query-shell')).toHaveLength(count);
  });
});
