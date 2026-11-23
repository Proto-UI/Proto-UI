import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDocumentationSearchCommands, searchCommandParticipant } from './site-search-commands';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import type { MaterializedProjectionCandidate } from './PrototypePreviewer/projection-materializer';
import { WEBSITE_SHADCN_THEME_TOKENS } from './PrototypePreviewer/projection-theme';
import type { RuntimeId } from './PrototypePreviewer/runtimes/ids';

// The Pagefind boundary is controlled; the data/session owner, public Dialog,
// projection controllers, materializer, loaders and all four Adapters are real.
const resource = vi.hoisted(() => ({ create: vi.fn(), search: vi.fn(), dispose: vi.fn() }));
vi.mock('./site-pagefind-resource', () => ({
  createSitePagefindResource: () => {
    resource.create();
    return { load: async () => ({ search: resource.search }), dispose: resource.dispose };
  },
}));
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

const cleanups: Array<() => void | Promise<void>> = [];
const releases: Array<() => void> = [];
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  releases.push(() => resolve());
  return { promise, resolve };
}
beforeEach(() => {
  localStorage.setItem(PREFERRED_ADAPTER_KEY, 'wc');
  resource.create.mockReset();
  resource.dispose.mockReset();
  resource.search.mockReset().mockImplementation(async (query: string) => ({
    results: [
      {
        id: query,
        data: async () => ({ url: `/docs/${query}`, meta: { title: `Result ${query}` } }),
      },
    ],
  }));
});
afterEach(async () => {
  releases.splice(0).forEach((release) => release());
  const errors: unknown[] = [];
  for (const cleanup of cleanups.splice(0).reverse()) {
    try {
      await cleanup();
    } catch (error) {
      errors.push(error);
    }
  }
  vi.restoreAllMocks();
  localStorage.removeItem(PREFERRED_ADAPTER_KEY);
  document.body.replaceChildren();
  if (errors.length) throw new AggregateError(errors, 'Search recovery fixture cleanup failed');
});

function mount(family: 'shadcn' | 'brutalist' = 'shadcn') {
  const root = document.createElement('site-search');
  root.dataset.searchComposition = 'command-dialog';
  root.dataset.searchStyle = 'rhea';
  root.dataset.searchInitialFamily = family;
  root.dataset.pagefindBundle = '/pagefind/';
  root.dataset.openLabel = 'Search documents';
  root.dataset.searchCopy = JSON.stringify({
    title: 'Search',
    description: 'Search documents',
    placeholder: 'Search',
    hint: 'Type to search',
    loading: 'Loading',
    empty: 'No results',
    error: 'Unavailable',
    retry: 'Retry',
    more: 'More',
    close: 'Close',
    count: '{count} documents',
  });
  root.innerHTML =
    '<div data-search-command-mount="open"></div><div data-search-dialog-mount></div>';
  // Happy DOM does not inherit custom properties. These explicit fixture
  // inputs use the real theme reader, as in the existing public-mode suite.
  for (const scope of [
    root,
    ...root.querySelectorAll<HTMLElement>(
      '[data-search-command-mount], [data-search-dialog-mount]'
    ),
  ])
    for (const token of WEBSITE_SHADCN_THEME_TOKENS)
      scope.style.setProperty(`--pui-${token}`, token.startsWith('radius') ? '0.5rem' : '#f5f5f5');
  document.body.append(root);
  const owner = searchCommandParticipant(root);
  cleanups.push(() => owner.dispose());
  const failure = new Error('Injected first Dialog materialization failure');
  const materialize = owner.materializeDialog.bind(owner);
  const dialogCalls = vi
    .spyOn(owner, 'materializeDialog')
    .mockImplementation(materialize)
    .mockRejectedValueOnce(failure);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const scope = initDocumentationSearchCommands(owner);
  cleanups.push(() => scope.destroy());
  return { root, owner, scope, failure, errors, dialogCalls, materialize };
}
function editor(): HTMLInputElement | null {
  const mount = document.querySelector<HTMLElement>('[data-search-dialog-mount]');
  const host = mount?.querySelector<HTMLElement>('[data-projection-generation-state="active"]');
  const owner = mount?.dataset.projectionOwner;
  const generation = host?.dataset.projectionGenerationHost;
  if (!owner || !generation) return null;
  const query = document.querySelector<HTMLElement>(
    `[data-projection-owner="${owner}"][data-projection-generation="${generation}"][data-demo-ref="query"]`
  );
  return query?.matches('input')
    ? (query as HTMLInputElement)
    : (query?.querySelector('input') ?? null);
}
function changeRuntime(runtime: RuntimeId) {
  document.dispatchEvent(
    new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
  );
}
async function failFirst(fixture: ReturnType<typeof mount>) {
  await fixture.scope.ready;
  expect(fixture.dialogCalls).not.toHaveBeenCalled();
  expect(fixture.root.dataset.searchView).toBe('ready');
  fixture.owner.open();
  await vi.waitFor(() =>
    expect(fixture.errors).toHaveBeenCalledWith(
      '[SiteSearch] Search command projection failed.',
      fixture.failure
    )
  );
  expect(fixture.root.dataset.searchView).toBe('unavailable');
  expect(fixture.dialogCalls).toHaveBeenCalledOnce();
  expect(editor()).toBeNull();
}
async function expectUsable(fixture: ReturnType<typeof mount>, query: string) {
  await vi.waitFor(() => {
    expect(editor()?.isConnected).toBe(true);
    expect(document.activeElement).toBe(editor());
  });
  const input = editor()!;
  input.value = query;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await vi.waitFor(() => expect(document.body.textContent).toContain(`Result ${query}`));
  expect(fixture.root.dataset.searchView).toBe('ready');
  expect(searchCommandParticipant(fixture.root)).toBe(fixture.owner);
  expect(resource.create).toHaveBeenCalledOnce();
  expect(resource.dispose).not.toHaveBeenCalled();
}

describe('Docs Search first Dialog materialization recovery', () => {
  it.each(['shadcn', 'brutalist'] as const)(
    'reopens a usable %s Dialog on the same owner',
    async (family) => {
      const fixture = mount(family);
      await failFirst(fixture);
      const opener = fixture.root.querySelector('[data-open-modal]');
      fixture.owner.toggle();
      fixture.owner.open();
      await expectUsable(fixture, 'retained');
      expect(fixture.dialogCalls).toHaveBeenCalledTimes(2);
      expect(fixture.root.querySelector('[data-open-modal]')).toBe(opener);
      fixture.owner.toggle();
      fixture.owner.open();
      await vi.waitFor(() => expect(editor()?.value).toBe('retained'));
      expect(fixture.dialogCalls).toHaveBeenCalledTimes(2);
      expect(fixture.errors).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    'recovers the settled failure on %s preference without replacing its data owner',
    async (runtime) => {
      const fixture = mount();
      await failFirst(fixture);
      changeRuntime(runtime);
      await expectUsable(fixture, 'adapter');
      expect(fixture.dialogCalls).toHaveBeenCalledTimes(2);
      expect(fixture.dialogCalls.mock.calls[1]![0].selection.runtimeId).toBe(runtime);
      expect(fixture.root.dataset.searchRuntime).toBe(runtime);
      expect(fixture.errors).toHaveBeenCalledTimes(1);
    }
  );

  it('coalesces repeated opens while recovering and retires the pending candidate on disposal', async () => {
    const fixture = mount();
    await failFirst(fixture);
    const gate = deferred();
    const reached = deferred();
    let prepared: MaterializedProjectionCandidate | undefined;
    let activate = vi.fn();
    let dispose = vi.fn();
    fixture.dialogCalls.mockImplementation(async (...args) => {
      prepared = await fixture.materialize(...args);
      activate = vi.fn(() => prepared!.activate());
      dispose = vi.fn(() => prepared!.dispose());
      reached.resolve();
      await gate.promise;
      return { ...prepared, activate, dispose };
    });
    fixture.owner.toggle();
    fixture.owner.open();
    expect(fixture.dialogCalls).toHaveBeenCalledTimes(2);
    await reached.promise;
    for (let index = 0; index < 3; index++) {
      fixture.owner.open();
      fixture.owner.toggle();
      fixture.owner.open();
    }
    expect(fixture.dialogCalls).toHaveBeenCalledTimes(2);
    const destruction = fixture.scope.destroy();
    fixture.owner.dispose();
    let finished = false;
    void destruction.then(() => {
      finished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(finished).toBe(false);
    gate.resolve();
    await destruction;
    expect(activate).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledOnce();
    expect(prepared!.host.isConnected).toBe(false);
    expect(document.querySelector('[data-demo-ref="panel"]')).toBeNull();
    changeRuntime('react');
    fixture.owner.open();
    expect(fixture.dialogCalls).toHaveBeenCalledTimes(2);
    expect(resource.dispose).toHaveBeenCalledOnce();
  });

  it('cannot publish a stale recovery candidate after a newer runtime commits', async () => {
    const fixture = mount();
    await failFirst(fixture);
    const gate = deferred();
    const reached = deferred();
    let old: MaterializedProjectionCandidate | undefined;
    const oldActivate = vi.fn();
    const oldDispose = vi.fn();
    fixture.dialogCalls.mockImplementationOnce(async (...args) => {
      old = await fixture.materialize(...args);
      reached.resolve();
      await gate.promise;
      return {
        ...old,
        activate() {
          oldActivate();
          old!.activate();
        },
        dispose() {
          oldDispose();
          return old!.dispose();
        },
      };
    });
    fixture.owner.toggle();
    fixture.owner.open();
    expect(fixture.dialogCalls).toHaveBeenCalledTimes(2);
    await reached.promise;
    changeRuntime('react');
    await expectUsable(fixture, 'newest');
    const current = editor();
    gate.resolve();
    await vi.waitFor(() => expect(oldDispose).toHaveBeenCalledOnce());
    expect(oldActivate).not.toHaveBeenCalled();
    expect(old!.host.isConnected).toBe(false);
    expect(editor()).toBe(current);
    expect(editor()?.value).toBe('newest');
    expect(fixture.root.dataset.searchRuntime).toBe('react');
    expect(fixture.root.dataset.searchView).toBe('ready');
  });
});
