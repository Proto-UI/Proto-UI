import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initDocumentationSearchCommands, searchCommandParticipant } from './site-search-commands';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import { WEBSITE_SHADCN_THEME_TOKENS } from './PrototypePreviewer/projection-theme';
import type { RuntimeId } from './PrototypePreviewer/runtimes/ids';

// Control only data loading and one explicit renderer completion boundary.
// Controllers, compositions, theme reads, renderers and Adapters remain real.
const observation = vi.hoisted(() => ({
  renderGate: undefined as { reached(host: HTMLElement): void; release: Promise<void> } | undefined,
}));
vi.mock('./site-pagefind-resource', () => ({
  createSitePagefindResource: () => ({
    load: async () => ({ search: async () => ({ results: [] }) }),
    dispose() {},
  }),
}));
vi.mock('./PrototypePreviewer/demo-renderer', async (original) => {
  const actual = await original<typeof import('./PrototypePreviewer/demo-renderer')>();
  return {
    ...actual,
    async renderDemo(options: Parameters<typeof actual.renderDemo>[0]) {
      const result = await actual.renderDemo(options);
      const gate = observation.renderGate;
      if (gate && options.host.closest('[data-search-dialog-mount]')) {
        observation.renderGate = undefined;
        gate.reached(options.host);
        await gate.release;
      }
      return result;
    },
  };
});
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

const cleanups: Array<() => unknown | Promise<unknown>> = [];
const releases: Array<() => void> = [];
let previousRuntime: string | null;
beforeEach(() => {
  previousRuntime = localStorage.getItem(PREFERRED_ADAPTER_KEY);
});
afterEach(async () => {
  observation.renderGate = undefined;
  releases.splice(0).forEach((release) => release());
  const errors: unknown[] = [];
  for (const cleanup of cleanups.splice(0).reverse()) {
    try {
      await cleanup();
    } catch (error) {
      errors.push(error);
    }
  }
  if (previousRuntime === null) localStorage.removeItem(PREFERRED_ADAPTER_KEY);
  else localStorage.setItem(PREFERRED_ADAPTER_KEY, previousRuntime);
  vi.restoreAllMocks();
  document.body.replaceChildren();
  if (errors.length) throw new AggregateError(errors, 'Docs theme fixture cleanup failed');
});

function mount(runtime: RuntimeId = 'wc') {
  localStorage.setItem(PREFERRED_ADAPTER_KEY, runtime);
  const root = document.createElement('site-search');
  root.dataset.searchComposition = 'command-dialog';
  root.dataset.searchStyle = 'rhea';
  root.dataset.searchInitialFamily = 'shadcn';
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
    '<div data-search-composition-mount><div data-search-command-mount="open"></div><div data-search-dialog-mount></div></div>';
  const openerMount = root.querySelector<HTMLElement>('[data-search-command-mount]')!;
  const dialogMount = root.querySelector<HTMLElement>('[data-search-dialog-mount]')!;
  // Happy DOM does not inherit custom properties onto these scopes. Supply
  // identical explicit inputs on the two mounts, as in the public-mode fixture.
  const inputs = [root, openerMount, dialogMount];
  for (const input of inputs)
    for (const token of WEBSITE_SHADCN_THEME_TOKENS)
      input.style.setProperty(`--pui-${token}`, token.startsWith('radius') ? '0.5rem' : '#f5f5f5');
  const setBackground = (color: string) => {
    for (const input of inputs) input.style.setProperty('--pui-background', color);
  };
  document.body.append(root);

  // Observe complete real theme-bank reads, excluding ordinary focus/layout
  // computed-style reads on the same ancestor. Values are returned unchanged.
  const bankReads: Array<{ source: string; background: string }> = [];
  const compute = window.getComputedStyle.bind(window);
  const properties = WEBSITE_SHADCN_THEME_TOKENS.map((token) => `--pui-${token}`);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const declaration = compute(element, pseudo);
    const index = inputs.indexOf(element as HTMLElement);
    if (index < 0) return declaration;
    const values = new Map<string, string>();
    let recorded = false;
    return new Proxy(declaration, {
      get(target, key) {
        if (key === 'getPropertyValue')
          return (property: string) => {
            const value = target.getPropertyValue(property);
            if (properties.includes(property)) values.set(property, value);
            if (!recorded && properties.every((name) => values.has(name))) {
              recorded = true;
              bankReads.push({
                source: ['owner', 'opener-mount', 'dialog-mount'][index]!,
                background: values.get('--pui-background')!,
              });
            }
            return value;
          };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  });
  const owner = searchCommandParticipant(root);
  cleanups.push(() => owner.dispose());
  const start = () => {
    const controller = initDocumentationSearchCommands(owner);
    cleanups.push(() => controller.destroy());
    return controller;
  };
  return { root, owner, start, bankReads, setBackground, openerMount, dialogMount };
}

function surface(generation: number, ref: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-projection-generation="${generation}"][data-demo-ref="${ref}"]`
  );
  if (!element) throw new Error(`Missing Search ${generation}/${ref}`);
  return element;
}
async function presented(generation: number) {
  await vi.waitFor(() => {
    expect(surface(generation, 'panel').getAttribute('data-transition-state')).toBe('entered');
    expect(surface(generation, 'query').isConnected).toBe(true);
  });
}
function switchRuntime(runtime: RuntimeId) {
  document.dispatchEvent(
    new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
  );
}

it('initializes the real Docs opener from one unchanged owner theme bank', async () => {
  const { start, bankReads, openerMount } = mount();
  await start().ready;
  const scope = openerMount.querySelector<HTMLElement>('[data-projection-scope]')!;
  expect(scope.style.getPropertyValue('--pui-background')).toBe('#f5f5f5');
  expect(openerMount.querySelector('[data-open-modal]')).not.toBeNull();
  expect(bankReads, JSON.stringify(bankReads)).toHaveLength(1);
});

it('does not reread an unchanged theme bank after the Vue to React candidates are prepared', async () => {
  const { root, owner, start, bankReads } = mount('vue');
  await start().ready;
  owner.open();
  await presented(1);
  const oldOpener = root.querySelector<HTMLElement>('[data-open-modal]')!;
  bankReads.length = 0;
  switchRuntime('react');
  await vi.waitFor(() => expect(root.dataset.searchRuntime).toBe('react'));
  await presented(2);
  await vi.waitFor(() => expect(oldOpener.isConnected).toBe(false));
  expect(surface(2, 'panel').style.getPropertyValue('--pui-background')).toBe('#f5f5f5');
  expect(bankReads, JSON.stringify(bankReads)).toHaveLength(2);
});

it('keeps preparation hidden and applies a theme changed during real Dialog rendering', async () => {
  const { owner, start, setBackground } = mount();
  await start().ready;
  let reached!: (host: HTMLElement) => void;
  const rendered = new Promise<HTMLElement>((resolve) => (reached = resolve));
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  releases.push(release);
  observation.renderGate = { reached, release: pending };
  owner.open();
  const host = await rendered;
  expect(host.dataset.projectionGenerationState).toBe('staging');
  expect(host.inert).toBe(true);
  setBackground('#123456');
  release();
  await presented(1);
  expect(surface(1, 'panel').style.getPropertyValue('--pui-background')).toBe('#123456');
  setBackground('#654321');
  await vi.waitFor(() =>
    expect(surface(1, 'panel').style.getPropertyValue('--pui-background')).toBe('#654321')
  );
});

it('retains the prior live theme owner when replacement publication fails', async () => {
  const { root, owner, start, setBackground, openerMount } = mount();
  const prepare = owner.prepareCommit;
  const failure = new Error('Fixture publication failure');
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  owner.prepareCommit = (commit) => {
    const publication = prepare(commit);
    return {
      ...publication,
      publish() {
        publication.publish();
        if (commit.generation === 2) throw failure;
      },
    };
  };
  await start().ready;
  const oldOpener = root.querySelector<HTMLElement>('[data-open-modal]')!;
  const oldScope = openerMount.querySelector<HTMLElement>('[data-projection-scope]')!;
  switchRuntime('vue');
  await vi.waitFor(() => expect(root.dataset.searchView).toBe('retained'));
  expect(error).toHaveBeenCalledWith('[SiteSearch] Search command projection failed.', failure);
  expect(root.dataset.searchRuntime).toBe('wc');
  expect(oldOpener.isConnected).toBe(true);
  expect(oldScope.closest<HTMLElement>('[data-projection-generation-state]')?.inert).toBe(false);
  setBackground('#123456');
  await vi.waitFor(() =>
    expect(oldScope.style.getPropertyValue('--pui-background')).toBe('#123456')
  );
});

it('rejects a missing owner token even when a mount retains a complete theme copy', async () => {
  const { root, start, openerMount } = mount();
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  root.style.removeProperty('--pui-popover');
  expect(openerMount.style.getPropertyValue('--pui-popover')).toBe('#f5f5f5');
  const controller = start();
  await controller.ready;
  expect(root.dataset.searchView).toBe('unavailable');
  expect(error).toHaveBeenCalledWith(
    '[SiteSearch] Search command projection failed.',
    expect.objectContaining({ message: expect.stringContaining('missing required --pui-popover') })
  );
  expect(openerMount.querySelector('[data-projection-generation-host]')).toBeNull();
  root.style.setProperty('--pui-popover', '#f5f5f5');
  await controller.refresh();
  expect(root.dataset.searchView).toBe('ready');
  expect(openerMount.querySelector('[data-open-modal]')).not.toBeNull();
});

it('revokes theme work on disposal even with an already queued owner-style mutation', async () => {
  const { root, owner, start, bankReads, setBackground } = mount();
  const controller = start();
  await controller.ready;
  owner.open();
  await presented(1);
  const oldPanel = surface(1, 'panel');
  setBackground('#123456');
  await controller.destroy();
  const retiredBackground = oldPanel.style.getPropertyValue('--pui-background');
  bankReads.length = 0;
  const delivered = new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      observer.disconnect();
      resolve();
    });
    observer.observe(root, { attributes: true, attributeFilter: ['style'] });
  });
  setBackground('#654321');
  await delivered;
  await Promise.resolve();
  expect(bankReads).toEqual([]);
  expect(oldPanel.isConnected).toBe(false);
  expect(oldPanel.style.getPropertyValue('--pui-background')).toBe(retiredBackground);
});
