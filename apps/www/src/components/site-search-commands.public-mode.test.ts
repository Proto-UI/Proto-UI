import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCommandParticipant } from './site-search-commands';
import type { MaterializedProjectionCandidate } from './PrototypePreviewer/projection-materializer';
import type { RuntimeId } from './PrototypePreviewer/runtimes/ids';
import { WEBSITE_SHADCN_THEME_TOKENS } from './PrototypePreviewer/projection-theme';

// Resource boundary only: real owner/session/data/composition/materializer/loaders/adapters.
const resource = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('./site-pagefind-resource', () => ({
  createSitePagefindResource: () => ({
    load: async () => ({ search: resource.search }),
    dispose() {},
  }),
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

const owners: Array<ReturnType<typeof searchCommandParticipant>> = [];
const candidates: MaterializedProjectionCandidate[] = [];
const copy = {
  title: 'Search documents',
  description: 'Search and open a document',
  placeholder: 'Search',
  hint: 'Type to search',
  loading: 'Loading',
  empty: 'No results',
  error: 'Unavailable',
  retry: 'Retry',
  more: 'More',
  close: 'Close search',
  count: '{count} documents',
};
beforeEach(() => {
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
  const errors: unknown[] = [];
  for (const candidate of candidates.splice(0).reverse()) {
    try {
      await candidate.dispose();
    } catch (error) {
      errors.push(error);
    }
  }
  for (const owner of owners.splice(0)) {
    try {
      owner.dispose();
    } catch (error) {
      errors.push(error);
    }
  }
  document.body.replaceChildren();
  if (errors.length) throw new AggregateError(errors, 'Search materializer test cleanup failed');
});
function mount(family: 'shadcn' | 'brutalist') {
  const root = document.createElement('site-search');
  root.dataset.searchComposition = 'command-dialog';
  root.dataset.searchStyle = 'rhea';
  root.dataset.searchCopy = JSON.stringify(copy);
  root.dataset.pagefindBundle = '/pagefind/';
  root.dataset.searchInitialFamily = family;
  root.dataset.openLabel = 'Search documents';
  root.dataset.ctrlLabel = 'Ctrl';
  // Explicit valid test inputs for the real public theme reader (no theme mock).
  for (const token of WEBSITE_SHADCN_THEME_TOKENS)
    root.style.setProperty(`--pui-${token}`, token.startsWith('radius') ? '0.5rem' : '#f5f5f5');
  root.innerHTML =
    '<div data-search-composition-mount><div data-search-command-mount="open"></div><div data-search-dialog-mount></div></div>';
  // Happy DOM does not inherit custom properties onto these reader scopes.
  // Supply the same explicit fixture theme on the actual two mounts; keep the
  // real theme reader and its missing-token rejection in the production path.
  for (const mount of root.querySelectorAll<HTMLElement>(
    '[data-search-command-mount], [data-search-dialog-mount]'
  ))
    for (const token of WEBSITE_SHADCN_THEME_TOKENS)
      mount.style.setProperty(`--pui-${token}`, root.style.getPropertyValue(`--pui-${token}`));
  document.body.append(root);
  const owner = searchCommandParticipant(root);
  owners.push(owner);
  return { root, owner };
}
function findSurface(generation: number, ref: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-projection-generation="${generation}"][data-demo-ref="${ref}"]`
  );
}
function surface(generation: number, ref: string): HTMLElement {
  const value = findSurface(generation, ref);
  if (!value) throw new Error(`Missing committed Search ${generation}/${ref}`);
  return value;
}
function expectClosed(generation: number) {
  const panel = findSurface(generation, 'panel');
  // Overlay adapters may keep detached content connected or outside Document.
  expect(!panel || panel.hasAttribute('data-pui-view-detached')).toBe(true);
}
function editor(generation: number): HTMLInputElement {
  const root = surface(generation, 'query');
  const input = root.matches('input') ? root : root.querySelector('input');
  if (!input) throw new Error(`Search ${generation} has no native editor`);
  return input as HTMLInputElement;
}
function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}
async function prepare(
  owner: ReturnType<typeof searchCommandParticipant>,
  family: 'shadcn' | 'brutalist',
  runtime: RuntimeId,
  generation: number
) {
  const request = { selection: { runtimeId: runtime, projectionFamilyId: family }, generation };
  // This is the real participant/materializer path, including manifest and full registry lookup.
  const prepared = await owner.materialize(request, 'public-test');
  candidates.push(...prepared);
  expect(prepared).toHaveLength(2);
  for (const candidate of prepared) {
    expect(candidate.host.dataset.projectionGenerationState).not.toBe('active');
    expect(candidate.host.inert).toBe(true);
  }
  return {
    prepared,
    activate() {
      for (const candidate of prepared) candidate.activate();
      owner.prepareCommit(request).publish();
      for (const candidate of prepared) {
        expect(candidate.host.dataset.projectionGenerationState).toBe('active');
        expect(candidate.host.inert).toBe(false);
      }
    },
  };
}
describe('public-mode Search through the actual projection materializer', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    for (const family of ['shadcn', 'brutalist'] as const) {
      it(`${runtime}/${family}: staged activation, close/reopen and generation replacement retain the live query`, async () => {
        const { root, owner } = mount(family);
        const openMount = root.querySelector<HTMLElement>('[data-search-command-mount="open"]')!;
        const dialogMount = root.querySelector<HTMLElement>('[data-search-dialog-mount]')!;
        expect(openMount.parentElement).toBe(dialogMount.parentElement);
        expect(openMount.contains(dialogMount)).toBe(false);
        expect(dialogMount.contains(openMount)).toBe(false);
        const first = await prepare(owner, family, runtime, 1);
        expect(first.prepared[0]!.host.parentElement).toBe(openMount);
        expect(first.prepared[1]!.host.parentElement).toBe(dialogMount);
        expect(first.prepared[0]!.host.dataset.projectionOwnerHost).not.toBe(
          first.prepared[1]!.host.dataset.projectionOwnerHost
        );
        owner.open();
        expect(resource.search).not.toHaveBeenCalled();
        expectClosed(1);
        first.activate();
        await vi.waitFor(() => {
          expect(surface(1, 'panel').hasAttribute('data-pui-view-detached')).toBe(false);
          expect(root.contains(surface(1, 'panel'))).toBe(false);
          expect(editor(1).isConnected).toBe(true);
        });
        let oldEditor = editor(1);
        type(oldEditor, 'retained');
        await vi.waitFor(() =>
          expect(surface(1, 'results').textContent).toContain('Result retained')
        );
        expect(resource.search).toHaveBeenCalledWith('retained');
        let oldClose = surface(1, 'close');
        expect(oldClose.querySelector('[role="button"],button,input,a[href]')).toBeNull();
        oldClose.click();
        await vi.waitFor(() => expectClosed(1));
        owner.open();
        await vi.waitFor(() => {
          expect(surface(1, 'panel').hasAttribute('data-pui-view-detached')).toBe(false);
          expect(editor(1).value).toBe('retained');
          expect(surface(1, 'results').textContent).toContain('Result retained');
        });
        oldEditor = editor(1);
        oldClose = surface(1, 'close');
        const second = await prepare(owner, family, runtime, 2);
        for (const mount of [openMount, dialogMount]) {
          const hosts = [
            ...mount.querySelectorAll<HTMLElement>('[data-projection-generation-host]'),
          ];
          expect(hosts).toHaveLength(2);
          expect(new Set(hosts.map((host) => host.dataset.projectionOwnerHost)).size).toBe(1);
          expect(
            hosts.filter((host) => host.dataset.projectionGenerationState === 'active')
          ).toHaveLength(1);
        }
        // Preparing another actual renderer must not close or reset the active owner/session.
        expect(surface(1, 'panel').hasAttribute('data-pui-view-detached')).toBe(false);
        expect(editor(1).value).toBe('retained');
        expectClosed(2);
        const beforeStagingInput = resource.search.mock.calls.length;
        if (findSurface(2, 'query')) type(editor(2), 'staging-must-not-write');
        await Promise.resolve();
        await Promise.resolve();
        expect(resource.search).toHaveBeenCalledTimes(beforeStagingInput);
        second.activate();
        await vi.waitFor(() => {
          expect(editor(2).value).toBe('retained');
          expect(surface(2, 'results').textContent).toContain('Result retained');
          expect(surface(2, 'panel').hasAttribute('data-pui-view-detached')).toBe(false);
        });
        for (const candidate of first.prepared) {
          expect(candidate.host.inert).toBe(true);
          expect(candidate.host.dataset.projectionGenerationState).not.toBe('active');
        }
        const beforeRetiredInput = resource.search.mock.calls.length;
        type(oldEditor, 'retired-must-not-write');
        oldClose.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(resource.search).toHaveBeenCalledTimes(beforeRetiredInput);
        expect(editor(2).value).toBe('retained');
        expect(surface(2, 'panel').hasAttribute('data-pui-view-detached')).toBe(false);
        for (const candidate of first.prepared) {
          await candidate.dispose();
          expect(candidate.host.isConnected).toBe(false);
          for (const current of second.prepared) {
            expect(current.host.isConnected).toBe(true);
            expect(current.host.inert).toBe(false);
            expect(current.host.dataset.projectionGenerationState).toBe('active');
          }
          expect(surface(2, 'panel').hasAttribute('data-pui-view-detached')).toBe(false);
          expect(editor(2).value).toBe('retained');
        }
        type(editor(2), 'current');
        await vi.waitFor(() =>
          expect(surface(2, 'results').textContent).toContain('Result current')
        );
        expect(
          resource.search.mock.calls.some(([query]) => String(query).includes('must-not-write'))
        ).toBe(false);
        expect(root.dataset.searchGeneration).toBe('2');
        expect(root.dataset.searchCompositionError).toBeUndefined();
      });
    }
  }
});
