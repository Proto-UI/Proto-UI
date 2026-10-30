import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteSearchShortcutLabel } from '../site-search-shortcut';
import { PREFERRED_ADAPTER_EVENT } from '../adapter-preference';
import { searchCommandParticipant, initDocumentationSearchCommands } from '../site-search-commands';
vi.setConfig({ testTimeout: 20_000 });
const resourceBoundary = vi.hoisted(() => ({
  current: null as null | { fetch: typeof fetch; importModule(url: string): Promise<unknown> },
}));
vi.mock('../site-pagefind-resource', async (original) => {
  const actual = await original<typeof import('../site-pagefind-resource')>();
  return {
    ...actual,
    createSitePagefindResource(options: Parameters<typeof actual.createSitePagefindResource>[0]) {
      if (!resourceBoundary.current) throw new Error('Missing test resource boundary');
      return actual.createSitePagefindResource({ ...options, ...resourceBoundary.current });
    },
  };
});
vi.mock('../PrototypePreviewer/runtimes/react-runtime', async (original) => {
  const actual = await original<typeof import('../PrototypePreviewer/runtimes/react-runtime')>();
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
vi.mock('../PrototypePreviewer/runtimes/vue-runtime', async (original) => {
  const actual = await original<typeof import('../PrototypePreviewer/runtimes/vue-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue/package.json'));
  return { ...actual, loadVue: async () => require('vue') };
});
vi.mock('../PrototypePreviewer/runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('../PrototypePreviewer/runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue2/package.json'));
  return { ...actual, loadVue2: async () => require('vue') };
});
vi.mock('../PrototypePreviewer/projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: () => ({
    '--pui-background': '#fff',
    '--pui-foreground': '#111',
  }),
  applyProjectionThemeSurfaceStyle: () => {},
  watchProjectionThemeSurfaceStyle: (
    _family: unknown,
    _root: unknown,
    change: (theme: Record<string, string>) => void
  ) => {
    change({ '--pui-background': '#fff', '--pui-foreground': '#111' });
    return () => {};
  },
}));

const source = readFileSync('apps/www/src/components/override/Search.astro', 'utf8');
const start = source.indexOf('<script>');
const end = source.indexOf('</script>', start);
if (start < 0 || end < 0) throw new Error('Search must retain its client script');
const script = source.slice(start + '<script>'.length, end);
const parsed = ts.createSourceFile('Search-client.ts', script, ts.ScriptTarget.Latest, true);
const clientClass = parsed.statements.find(
  (node) => ts.isClassDeclaration(node) && node.name?.text === 'SiteSearch'
);
if (!clientClass) throw new Error('Search must retain its real owner class');
// AST-select the actual class, not formatting-sensitive import or native-dialog rewrites.
const executable = ts.transpileModule(
  `${ts.createPrinter().printNode(ts.EmitHint.Unspecified, clientClass, parsed)}\nreturn SiteSearch;`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }
).outputText;
const cleanup: Array<() => void | Promise<void>> = [];
let serial = 0;
const settle = async () => {
  for (let turn = 0; turn < 30; turn++) await Promise.resolve();
};
const copy = {
  title: 'Search',
  description: 'Search documentation',
  placeholder: 'Search',
  hint: 'Type query',
  loading: 'Loading',
  empty: 'No results',
  error: 'Unavailable',
  retry: 'Retry',
  more: 'More',
  close: 'Close search',
  count: '{count} documents',
};
async function mount(family: 'shadcn' | 'brutalist', firstProbeOK = true) {
  const root = document.createElement(`public-search-test-${++serial}`);
  root.dataset.searchComposition = 'command-dialog';
  root.dataset.searchStyle = 'rhea';
  root.dataset.searchInitialFamily = family;
  root.dataset.searchCopy = JSON.stringify(copy);
  root.dataset.pagefindBundle = '/pagefind/';
  root.dataset.openLabel = 'Search';
  root.dataset.ctrlLabel = 'Ctrl';
  root.innerHTML =
    '<div data-search-composition-mount><div data-search-command-mount="open"></div><div data-search-dialog-mount></div></div>';
  document.body.append(root);
  let probeOK = firstProbeOK;
  const fetchIndex = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: probeOK }) as Response
  );
  const search = vi.fn(async (query: string) => ({
    results: [
      {
        id: query,
        data: async () => ({ url: `/docs/${query}`, meta: { title: `Result ${query}` } }),
      },
    ],
  }));
  const configure = vi.fn(async () => {});
  const loadRuntime = vi.fn(async () => ({ search, options: configure }));
  resourceBoundary.current = {
    fetch: fetchIndex as unknown as typeof fetch,
    importModule: loadRuntime,
  };
  let docs!: ReturnType<typeof initDocumentationSearchCommands>;
  const constructor = new Function(
    'searchCommandParticipant',
    'initDocumentationSearchCommands',
    'HTMLElement',
    executable
  )(
    searchCommandParticipant,
    (participant: Parameters<typeof initDocumentationSearchCommands>[0]) => {
      docs = initDocumentationSearchCommands(participant);
      return docs;
    },
    HTMLElement
  );
  const initialize = () => constructor.prototype.connectedCallback.call(root);
  const dispose = () => constructor.prototype.disconnectedCallback.call(root);
  initialize();
  await docs.ready;
  await settle();
  const ref = (name: string) => {
    const owner = root.querySelector<HTMLElement>('[data-search-dialog-mount]')!.dataset
      .projectionOwner;
    const gen = root.dataset.searchGeneration;
    return [...document.querySelectorAll<HTMLElement>('[data-demo-ref]')].find(
      (node) =>
        node.dataset.demoRef === name &&
        node.dataset.projectionOwner === owner &&
        node.dataset.projectionGeneration === gen
    );
  };
  cleanup.push(async () => {
    dispose();
    await docs.destroy();
    root.remove();
  });
  return {
    root,
    fetchIndex,
    loadRuntime,
    configure,
    search,
    ref,
    initialize,
    dispose,
    get docs() {
      return docs;
    },
    get trigger() {
      return root.querySelector<HTMLElement>(
        '[data-projection-generation-state="active"] [data-open-modal]'
      )!;
    },
    get close() {
      return ref('close')!;
    },
    get retry() {
      return ref('search-page-action');
    },
    get open() {
      const panel = ref('panel');
      return !!panel?.isConnected && !panel.hasAttribute('data-pui-view-detached');
    },
    get input() {
      const query = ref('query');
      return (query?.matches('input') ? query : query?.querySelector('input')) as
        | HTMLInputElement
        | undefined;
    },
    setProbe(value: boolean) {
      probeOK = value;
    },
    holdProbe() {
      let release!: () => void;
      fetchIndex.mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve({ ok: probeOK } as Response);
          })
      );
      return () => release();
    },
    async runtime(runtime: string) {
      document.dispatchEvent(
        new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
      );
      await vi.waitFor(() => expect(root.dataset.searchRuntime).toBe(runtime));
      await settle();
    },
  };
}
afterEach(async () => {
  vi.useRealTimers();
  const errors: unknown[] = [];
  for (const dispose of cleanup.splice(0).reverse()) {
    try {
      await dispose();
    } catch (error) {
      errors.push(error);
    }
  }
  document.body.replaceChildren();
  resourceBoundary.current = null;
  vi.restoreAllMocks();
  if (errors.length) throw new AggregateError(errors, 'Search command cleanup failed');
});
const click = (button: HTMLElement) =>
  (button.querySelector('path') ?? button).dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true })
  );
const hover = (trigger: HTMLElement) =>
  trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
const shortcut = (meta = false) =>
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', ctrlKey: !meta, metaKey: meta, cancelable: true })
  );
function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

describe('public Search intent and resource lifetime', () => {
  it('does no backend work without intent, then coalesces hover/open without opening during preparation', async () => {
    const f = await mount('shadcn');
    expect(f.fetchIndex).not.toHaveBeenCalled();
    const release = f.holdProbe();
    hover(f.trigger);
    hover(f.trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    expect(f.open).toBe(false);
    expect(f.loadRuntime).not.toHaveBeenCalled();
    click(f.trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    release();
    await vi.waitFor(() => expect(f.configure).toHaveBeenCalledTimes(1));
    expect(f.loadRuntime).toHaveBeenCalledTimes(1);
    expect(f.open).toBe(true);
  });
  it('keeps failed intent silent, permits explicit retry, and reuses one prepared backend', async () => {
    const f = await mount('shadcn', false);
    hover(f.trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    expect(f.open).toBe(false);
    expect(f.retry).toBeUndefined();
    f.setProbe(true);
    click(f.trigger);
    await vi.waitFor(() => expect(f.configure).toHaveBeenCalledTimes(1));
    expect(f.fetchIndex).toHaveBeenCalledTimes(2);
    expect(f.open).toBe(true);
    click(f.close);
    await settle();
    click(f.trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(2);
  });
  it('public leave/reenter starts one new preparation after a silent failure', async () => {
    const f = await mount('shadcn', false);
    hover(f.trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    f.setProbe(true);
    f.trigger.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    hover(f.trigger);
    await vi.waitFor(() => expect(f.configure).toHaveBeenCalledTimes(1));
    expect(f.fetchIndex).toHaveBeenCalledTimes(2);
    expect(f.open).toBe(false);
  });
  it('close/reopen during pending preparation only publishes to the newest open session', async () => {
    const f = await mount('shadcn');
    const release = f.holdProbe();
    click(f.trigger);
    await settle();
    click(f.close);
    await settle();
    expect(f.open).toBe(false);
    click(f.trigger);
    await settle();
    release();
    await vi.waitFor(() => expect(f.configure).toHaveBeenCalledTimes(1));
    expect(f.open).toBe(true);
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    expect(f.input).toBe(document.activeElement);
  });
  for (const action of ['close', 'disconnect', 'route'] as const) {
    it(`${action} suppresses late module rejection and retired gestures`, async () => {
      const f = await mount('shadcn');
      let reject!: (error: Error) => void;
      f.loadRuntime.mockImplementationOnce(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          })
      );
      click(f.trigger);
      await vi.waitFor(() => expect(f.loadRuntime).toHaveBeenCalledTimes(1));
      const oldTrigger = f.trigger;
      if (action === 'close') click(f.close);
      else if (action === 'route') document.dispatchEvent(new Event('astro:before-swap'));
      else f.dispose();
      await settle();
      reject(new Error('late offline'));
      await settle();
      expect(f.open).toBe(false);
      if (action !== 'close') {
        click(oldTrigger);
        shortcut();
        await settle();
        expect(f.open).toBe(false);
      }
      expect(f.root.dataset.searchCompositionError).toBeUndefined();
    });
  }
  it('keeps pending intent across host replacement while retired triggers cannot activate', async () => {
    const f = await mount('shadcn');
    const oldTrigger = f.trigger;
    const release = f.holdProbe();
    hover(oldTrigger);
    await settle();
    await f.runtime('react');
    click(oldTrigger);
    release();
    await settle();
    expect(f.open).toBe(false);
    expect(f.loadRuntime).toHaveBeenCalledTimes(1);
    click(f.trigger);
    await vi.waitFor(() => expect(f.open).toBe(true));
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
  });
  it('reconnected owner rejects the old import completion and reinitializes only on new intent', async () => {
    const f = await mount('shadcn');
    let resolve!: (value: Awaited<ReturnType<typeof f.loadRuntime>>) => void;
    f.loadRuntime.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    hover(f.trigger);
    await vi.waitFor(() => expect(f.loadRuntime).toHaveBeenCalledTimes(1));
    f.dispose();
    await f.docs.destroy();
    f.initialize();
    await f.docs.ready;
    resolve({ options: f.configure, search: f.search });
    await settle();
    expect(f.open).toBe(false);
    shortcut();
    await vi.waitFor(() => expect(f.open).toBe(true));
    expect(f.fetchIndex).toHaveBeenCalledTimes(2);
  });
  it('aborts the outstanding HEAD on disposal before late completion and removes resource intent subscriptions', async () => {
    const f = await mount('shadcn');
    const release = f.holdProbe();
    const trigger = f.trigger;
    hover(trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    const init = f.fetchIndex.mock.calls[0]?.[1];
    expect(init?.signal?.aborted).toBe(false);
    f.dispose();
    await f.docs.destroy();
    expect(init?.signal?.aborted).toBe(true);
    release();
    hover(trigger);
    await settle();
    expect(f.loadRuntime).not.toHaveBeenCalled();
    expect(f.open).toBe(false);
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
  });
  it('retains the 5000ms import timeout, recovers on intent, and ignores a late timed-out module', async () => {
    const f = await mount('shadcn');
    let resolve!: (value: Awaited<ReturnType<typeof f.loadRuntime>>) => void;
    f.loadRuntime.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    // Install the clock after framework mounting but before the bounded import attempt.
    vi.useFakeTimers();
    try {
      hover(f.trigger);
      await settle();
      await vi.advanceTimersByTimeAsync(5001);
      expect(f.open).toBe(false);
      expect(f.retry).toBeUndefined();
      click(f.trigger);
      await settle();
      await vi.advanceTimersByTimeAsync(1);
      resolve({ options: f.configure, search: f.search });
      await settle();
    } finally {
      vi.useRealTimers();
    }
    await vi.waitFor(() => expect(f.open).toBe(true));
    expect(f.configure).toHaveBeenCalledTimes(1);
  });
});
for (const family of ['shadcn', 'brutalist'] as const) {
  describe(`actual ${family} public Search gestures`, () => {
    it('opens once from the descendant and ignores a later native echo of the outward callback', async () => {
      const f = await mount(family);
      const trigger = f.trigger;
      trigger.dispatchEvent(new CustomEvent('click', { bubbles: true }));
      await settle();
      expect(f.open).toBe(true);
      click(trigger);
      await settle();
      expect(f.open).toBe(true);
      expect(f.fetchIndex).toHaveBeenCalledTimes(1);
      expect(f.loadRuntime).toHaveBeenCalledTimes(1);
      expect(f.input).toBe(document.activeElement);
      click(f.close);
      await settle();
      expect(f.open).toBe(false);
      expect(document.activeElement).toBe(f.trigger);
    });
    it('retains query on Enter/Space reopen and does not execute a result from the opening key', async () => {
      const f = await mount(family);
      click(f.trigger);
      await vi.waitFor(() => expect(f.open).toBe(true));
      type(f.input!, 'Button');
      await vi.waitFor(() => expect(f.ref('results')?.textContent).toContain('Result Button'));
      for (const key of ['Enter', ' ']) {
        click(f.close);
        await settle();
        f.trigger.focus();
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        f.trigger.dispatchEvent(event);
        f.trigger.dispatchEvent(
          new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true })
        );
        await vi.waitFor(() => expect(f.open).toBe(true));
        expect(f.input?.value).toBe('Button');
        expect(f.input).toBe(document.activeElement);
        // Search remains open: the opener's key cannot select an existing result.
        expect(f.open).toBe(true);
      }
    });
    it('preserves shortcut toggles and ignores composed/modified/prevented shortcuts', async () => {
      const f = await mount(family);
      for (const init of [{ altKey: true }, { isComposing: true }]) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, ...init }));
        await settle();
        expect(f.open).toBe(false);
      }
      const prevented = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
      prevented.preventDefault();
      window.dispatchEvent(prevented);
      await settle();
      expect(f.open).toBe(false);
      for (const meta of [false, true]) {
        shortcut(meta);
        await vi.waitFor(() => expect(f.open).toBe(true));
        shortcut(meta);
        await vi.waitFor(() => expect(f.open).toBe(false));
      }
      f.dispose();
      shortcut();
      await settle();
      expect(f.open).toBe(false);
    });
    it('keeps retry disabled/presentation during host replacement and closes before late recovery', async () => {
      const f = await mount(family, false);
      click(f.trigger);
      await vi.waitFor(() => expect(f.retry).toBeDefined());
      expect(f.retry).toBe(document.activeElement);
      const variant = family === 'brutalist' ? 'bg-secondary-background' : 'bg-secondary';
      expect(f.retry!.getAttribute('data-pui-style')).toContain(variant);
      f.setProbe(true);
      const release = f.holdProbe();
      click(f.retry!);
      await settle();
      expect(f.retry!.getAttribute('aria-disabled')).toBe('true');
      await f.runtime('vue');
      expect(f.retry!.getAttribute('aria-disabled')).toBe('true');
      expect(f.retry!.getAttribute('data-pui-style')).toContain(variant);
      click(f.close);
      await settle();
      release();
      await settle();
      expect(f.open).toBe(false);
      click(f.trigger);
      await vi.waitFor(() => expect(f.open).toBe(true));
      await vi.waitFor(() => expect(f.retry).toBeUndefined());
      expect(f.input).toBe(document.activeElement);
    });
    for (const runtime of ['react', 'vue', 'vue2', 'wc']) {
      it(`${runtime} consumes public focus/hover intent, retires old views and preserves session on repeated initialization`, async () => {
        const f = await mount(family);
        const oldTrigger = f.trigger;
        if (runtime !== 'wc') await f.runtime(runtime);
        if (oldTrigger !== f.trigger) {
          hover(oldTrigger);
          await settle();
          expect(f.fetchIndex).not.toHaveBeenCalled();
        }
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        f.trigger.focus();
        await vi.waitFor(() => expect(f.loadRuntime).toHaveBeenCalledTimes(1));
        expect(f.open).toBe(false);
        click(f.trigger);
        await vi.waitFor(() => expect(f.open).toBe(true));
        type(f.input!, 'Retained');
        await vi.waitFor(() => expect(f.ref('results')?.textContent).toContain('Result Retained'));
        const oldInput = f.input;
        const oldClose = f.close;
        f.initialize();
        f.initialize();
        await f.docs.refresh();
        await settle();
        await vi.waitFor(() => expect(f.input?.value).toBe('Retained'));
        expect(f.open).toBe(true);
        expect(f.fetchIndex).toHaveBeenCalledTimes(1);
        if (oldInput !== f.input) {
          expect(oldInput?.isConnected).toBe(false);
          type(oldInput!, 'retired');
          click(oldClose);
          await settle();
          expect(f.input?.value).toBe('Retained');
          expect(f.open).toBe(true);
        }
        click(f.close);
        await settle();
        expect(f.open).toBe(false);
      });
    }
  });
}
for (const stage of ['import', 'configure'] as const) {
  it(`keeps ${stage} failure silent on intent and recovers on explicit open`, async () => {
    const f = await mount('shadcn');
    (stage === 'import' ? f.loadRuntime : f.configure).mockRejectedValueOnce(new Error('offline'));
    hover(f.trigger);
    await settle();
    expect(f.open).toBe(false);
    expect(f.retry).toBeUndefined();
    click(f.trigger);
    await vi.waitFor(() => expect(f.open).toBe(true));
    await vi.waitFor(() => expect(f.retry).toBeUndefined());
    expect(f.fetchIndex).toHaveBeenCalledTimes(2);
  });
}
for (const userAgent of [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'Mozilla/5.0 (X11; Linux x86_64)',
]) {
  it(`retains the server/public command dual-platform shortcut: ${userAgent}`, async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    const f = await mount('shadcn');
    expect(f.trigger.querySelector('.site-search-shortcut')?.textContent?.trim()).toBe(
      siteSearchShortcutLabel('Ctrl')
    );
    expect(siteSearchShortcutLabel('Ctrl')).toBe('⌘ / Ctrl K');
    expect(source).toContain("siteSearchShortcutLabel(Astro.locals.t('search.ctrlKey'))");
  });
}

// Keep the previous cross-runtime Close focus guarantee as an executable gate.
// #908 records the unresolved public initial-entry policy; do not skip or soften it.
for (const family of ['shadcn', 'brutalist'] as const) {
  for (const runtime of ['react', 'vue', 'vue2', 'wc']) {
    it(`${family}/${runtime} retains Close focus through the actual generation transaction`, async () => {
      const f = await mount(family);
      if (runtime === 'wc') await f.runtime('react');
      click(f.trigger);
      await vi.waitFor(() => expect(f.open).toBe(true));
      const oldClose = f.close;
      oldClose.focus();
      await vi.waitFor(() => expect(document.activeElement).toBe(oldClose));
      await f.runtime(runtime);
      expect(f.close).not.toBe(oldClose);
      await vi.waitFor(() => expect(oldClose.isConnected).toBe(false));
      await vi.waitFor(() => expect(document.activeElement).toBe(f.close));
      // Later editing intent remains authoritative; stale command focus must not win.
      const currentInput = f.input;
      if (!currentInput) throw new Error('Expected current Search input');
      currentInput.focus();
      await settle();
      expect(document.activeElement).toBe(f.input);
      expect(f.open).toBe(true);
    });
  }
}
