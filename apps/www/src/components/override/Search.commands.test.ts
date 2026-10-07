import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { PREFERRED_ADAPTER_EVENT } from '../adapter-preference';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.setConfig({ testTimeout: 20_000 });
import { searchCommandParticipant, initDocumentationSearchCommands } from '../site-search-commands';
// Replace only the browser CDN dependency acquisition with already-installed
// framework packages. The renderer, adapters and prototypes remain real.
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
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Search must retain its client script');

// Execute the actual Astro client script with only build-time virtual imports,
// native dialog behavior and Pagefind/network service replaced. The Buttons,
// adapter, activation routing, public props and public focus API stay real.
const executable = ts.transpileModule(
  script
    .replace(/import\s+(?:type\s+)?\{[^}]+\}\s+from\s+['"][^'"]+['"];?/g, '')
    .replaceAll('import.meta.env.DEV', 'false')
    .replaceAll('import.meta.env.BASE_URL', "'/'")
    .replace('import(/* @vite-ignore */ `${bundlePath}pagefind.js`)', 'loadRuntime()')
    .replace("import('@pagefind/default-ui')", 'loadUI()')
    .replace("customElements.define('site-search', SiteSearch);", 'return SiteSearch;'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }
).outputText;

let serial = 0;
const cleanup: Array<() => void | Promise<void>> = [];
async function settle() {
  for (let turn = 0; turn < 30; turn++) await Promise.resolve();
}

async function mount(family: 'shadcn' | 'brutalist', firstProbeOK = true) {
  const tag = `search-commands-test-${++serial}`;
  document.body.innerHTML = `<header data-site-header>
    <${tag} data-search-initial-family="${family}" data-open-label="Search" data-close-label="Close search" data-retry-label="Retry" data-translations="{}">
      <div data-search-command-mount="open"></div>
      <dialog aria-label="Search"><div class="dialog-frame">
        <div data-search-command-mount="close"></div>
        <div class="search-container"><div class="search-initializing"></div><div id="starlight__search" hidden></div></div>
        <div class="search-failure" hidden><div data-search-command-mount="retry"></div></div>
      </div></dialog>
    </${tag}>
  </header>`;
  const root = document.querySelector<HTMLElement>(tag)!;
  const dialog = root.querySelector('dialog')!;
  const showModal = vi.fn(() => {
    if (dialog.open) throw new Error('Dialog already open');
    dialog.open = true;
  });
  dialog.showModal = showModal;
  dialog.close = vi.fn(() => {
    dialog.open = false;
    queueMicrotask(() => dialog.dispatchEvent(new Event('close')));
  });
  let probeOK = firstProbeOK;
  let releaseProbe: (() => void) | undefined;
  const fetchIndex = vi.fn(async () => ({ ok: probeOK }));
  vi.stubGlobal('fetch', fetchIndex);
  const buildUI = vi.fn(() => {
    const input = document.createElement('input');
    input.className = 'pagefind-ui__search-input';
    root.querySelector('#starlight__search')!.append(input);
  });
  class PagefindUI {
    constructor() {
      buildUI();
    }
    destroy() {}
  }
  const loadRuntime = vi.fn(async () => ({}));
  const loadUI = vi.fn(async () => ({ PagefindUI }));
  const listeners: Array<[string, EventListenerOrEventListenerObject]> = [];
  const originalAdd = window.addEventListener.bind(window);
  const add = vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (listener) listeners.push([type, listener]);
    originalAdd(type, listener, options);
  });
  let docs!: ReturnType<typeof initDocumentationSearchCommands>;
  const constructor = new Function(
    'pagefindUserConfig',
    'searchCommandParticipant',
    'initDocumentationSearchCommands',
    'loadRuntime',
    'loadUI',
    'HTMLElement',
    executable
  )(
    {},
    searchCommandParticipant,
    (participant: Parameters<typeof initDocumentationSearchCommands>[0]) => {
      docs = initDocumentationSearchCommands(participant);
      return docs;
    },
    loadRuntime,
    loadUI,
    HTMLElement
  );
  const initialize = () => constructor.prototype.connectedCallback.call(root);
  const dispose = () => constructor.prototype.disconnectedCallback.call(root);
  initialize();
  await docs.ready;
  await settle();
  const trigger = root.querySelector<HTMLElement>('[data-open-modal]')!;
  const close = root.querySelector<HTMLElement>('[data-close-modal]')!;
  const retry = root.querySelector<HTMLElement>('.search-failure__retry')!;
  cleanup.push(async () => {
    releaseProbe?.();
    dispose();
    await docs.destroy();
    for (const [type, listener] of listeners) window.removeEventListener(type, listener);
    add.mockRestore();
  });
  return {
    root,
    trigger,
    close,
    retry,
    dialog,
    showModal,
    fetchIndex,
    buildUI,
    loadRuntime,
    loadUI,
    initialize,
    dispose,
    docs,
    setProbe(value: boolean) {
      probeOK = value;
    },
    holdNextProbe() {
      fetchIndex.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseProbe = () => resolve({ ok: probeOK });
          })
      );
      return () => releaseProbe?.();
    },
  };
}

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  await settle();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function clickIcon(button: HTMLElement) {
  (button.querySelector('path') ?? button).dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true })
  );
}

describe('intent-only module preparation', () => {
  function hover(trigger: HTMLElement) {
    trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  }

  it('does no Pagefind work without intent, then deduplicates hover and open without constructing hidden UI', async () => {
    const f = await mount('shadcn');
    expect(f.fetchIndex).not.toHaveBeenCalled();
    expect(f.loadRuntime).not.toHaveBeenCalled();
    const release = f.holdNextProbe();
    hover(f.trigger);
    hover(f.trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    expect(f.dialog.open).toBe(false);
    expect(f.buildUI).not.toHaveBeenCalled();
    clickIcon(f.trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    release();
    await settle();
    expect(f.loadRuntime).toHaveBeenCalledTimes(1);
    expect(f.loadUI).toHaveBeenCalledTimes(1);
    expect(f.buildUI).toHaveBeenCalledTimes(1);
  });

  it('starts both module imports after HEAD without serializing the cold open', async () => {
    const f = await mount('shadcn');
    const releaseProbe = f.holdNextProbe();
    let releaseRuntime!: (value: {}) => void;
    f.loadRuntime.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseRuntime = resolve;
        })
    );
    clickIcon(f.trigger);
    await settle();
    expect(f.loadRuntime).not.toHaveBeenCalled();
    expect(f.loadUI).not.toHaveBeenCalled();
    releaseProbe();
    await settle();
    try {
      expect(f.loadRuntime).toHaveBeenCalledTimes(1);
      expect(f.loadUI).toHaveBeenCalledTimes(1);
      expect(f.buildUI).not.toHaveBeenCalled();
    } finally {
      releaseRuntime({});
      await settle();
    }
    expect(f.buildUI).toHaveBeenCalledTimes(1);
    expect(f.root.querySelector('.pagefind-ui__search-input')).toBe(document.activeElement);
  });

  it('prepares on public keyboard-focus intent but leaves the native dialog and DOM untouched', async () => {
    const f = await mount('shadcn');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    f.trigger.focus();
    await settle();
    expect(f.loadRuntime).toHaveBeenCalledTimes(1);
    expect(f.loadUI).toHaveBeenCalledTimes(1);
    expect(f.buildUI).not.toHaveBeenCalled();
    expect(f.dialog.open).toBe(false);
    expect(document.activeElement).toBe(f.trigger);
  });

  it('keeps intent failure silent and permits actual open to retry once', async () => {
    const f = await mount('shadcn', false);
    hover(f.trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    expect(f.root.querySelector<HTMLElement>('.search-failure')!.hidden).toBe(true);
    expect(f.dialog.open).toBe(false);
    expect(f.buildUI).not.toHaveBeenCalled();
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    f.setProbe(true);
    clickIcon(f.trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(2);
    expect(f.buildUI).toHaveBeenCalledTimes(1);
  });

  it('does not construct or focus after close during preparation; reuses modules on reopen', async () => {
    const f = await mount('shadcn');
    const release = f.holdNextProbe();
    hover(f.trigger);
    clickIcon(f.trigger);
    await settle();
    clickIcon(f.close);
    await settle();
    release();
    await settle();
    expect(f.dialog.open).toBe(false);
    expect(f.loadUI).toHaveBeenCalledTimes(1);
    expect(f.buildUI).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(f.trigger);
    clickIcon(f.trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    expect(f.buildUI).toHaveBeenCalledTimes(1);
  });

  for (const stage of ['runtime', 'UI'] as const) {
    it(`keeps ${stage} import failure silent until explicit open and then recovers`, async () => {
      const f = await mount('shadcn');
      (stage === 'runtime' ? f.loadRuntime : f.loadUI).mockRejectedValueOnce(new Error('offline'));
      hover(f.trigger);
      await settle();
      expect(f.root.querySelector<HTMLElement>('.search-failure')!.hidden).toBe(true);
      expect(f.buildUI).not.toHaveBeenCalled();
      expect(f.fetchIndex).toHaveBeenCalledTimes(1);
      clickIcon(f.trigger);
      await settle();
      expect(f.fetchIndex).toHaveBeenCalledTimes(2);
      expect(f.buildUI).toHaveBeenCalledTimes(1);
    });
  }

  it('allows only the newest open to build after close and reopen during one preparation', async () => {
    const f = await mount('shadcn');
    const release = f.holdNextProbe();
    clickIcon(f.trigger);
    await settle();
    clickIcon(f.close);
    clickIcon(f.trigger);
    await settle();
    release();
    await settle();
    expect(f.dialog.open).toBe(true);
    expect(f.buildUI).toHaveBeenCalledTimes(1);
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.matches('.pagefind-ui__search-input')).toBe(true);
  });

  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const runtime of ['react', 'vue', 'vue2', 'wc']) {
      it(`consumes public intent from ${family}/${runtime} and ignores retired command subscriptions`, async () => {
        const f = await mount(family);
        document.dispatchEvent(
          new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
        );
        await vi.waitFor(() => expect(f.root.dataset.searchRuntime).toBe(runtime));
        const current = f.root.querySelector<HTMLElement>(
          '[data-projection-generation-state="active"] [data-open-modal]'
        )!;
        if (current !== f.trigger) {
          hover(f.trigger);
          await settle();
          expect(f.fetchIndex).not.toHaveBeenCalled();
        }
        hover(current);
        await settle();
        expect(f.fetchIndex).toHaveBeenCalledTimes(1);
        expect(f.loadUI).toHaveBeenCalledTimes(1);
        expect(f.buildUI).not.toHaveBeenCalled();
        expect(f.dialog.open).toBe(false);
      });
    }
  }

  it('retains pending intent modules across a runtime swap without giving retired commands UI ownership', async () => {
    const f = await mount('shadcn');
    const release = f.holdNextProbe();
    hover(f.trigger);
    await settle();
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
    );
    await vi.waitFor(() => expect(f.root.dataset.searchRuntime).toBe('react'));
    clickIcon(f.trigger);
    release();
    await settle();
    expect(f.dialog.open).toBe(false);
    expect(f.buildUI).not.toHaveBeenCalled();
    const current = f.root.querySelector<HTMLElement>(
      '[data-projection-generation-state="active"] [data-open-modal]'
    )!;
    current.click();
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    expect(f.buildUI).toHaveBeenCalledTimes(1);
    expect(f.dialog.open).toBe(true);
  });

  it('allows no old import continuation to write into a reconnected service', async () => {
    const f = await mount('shadcn');
    let resolveRuntime!: (value: object) => void;
    f.loadRuntime.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRuntime = resolve;
        })
    );
    hover(f.trigger);
    await settle();
    expect(f.loadRuntime).toHaveBeenCalledTimes(1);
    expect(f.loadUI).toHaveBeenCalledTimes(1);
    const uiCallsAtDisposal = f.loadUI.mock.calls.length;
    f.dispose();
    await f.docs.destroy();
    f.initialize();
    await vi.waitFor(() =>
      expect(
        f.root.querySelector('[data-projection-generation-state="active"] [data-open-modal]')
      ).not.toBeNull()
    );
    resolveRuntime({});
    await settle();
    // Parallel preparation began the import while this owner was alive.
    // Its late runtime completion cannot initiate another import or build UI.
    expect(f.loadUI).toHaveBeenCalledTimes(uiCallsAtDisposal);
    expect(f.buildUI).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await settle();
    expect(f.buildUI).toHaveBeenCalledTimes(1);
  });

  it('disposes an intent preparation without late UI or subscriptions', async () => {
    const f = await mount('shadcn');
    const release = f.holdNextProbe();
    hover(f.trigger);
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    f.dispose();
    release();
    hover(f.trigger);
    await settle();
    expect(f.loadRuntime).not.toHaveBeenCalled();
    expect(f.buildUI).not.toHaveBeenCalled();
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
  });
});

for (const family of ['shadcn', 'brutalist'] as const) {
  describe(`Search with real ${family} Buttons`, () => {
    it('opens once on native descendant activation, focuses the query and restores trigger focus on close', async () => {
      const { trigger, close, dialog, showModal, buildUI } = await mount(family);
      expect(trigger.getAttribute('role')).toBe('button');
      expect(trigger.getAttribute('aria-disabled')).toBe('false');
      const style = trigger.getAttribute('data-pui-style')!;
      expect(style).toContain(family === 'brutalist' ? 'border-black' : 'border-transparent');
      clickIcon(trigger);
      await settle();
      expect(dialog.open).toBe(true);
      expect(showModal).toHaveBeenCalledTimes(1);
      expect(buildUI).toHaveBeenCalledTimes(1);
      expect(document.activeElement?.matches('.pagefind-ui__search-input')).toBe(true);
      clickIcon(close);
      await settle();
      expect(dialog.open).toBe(false);
      expect(document.activeElement).toBe(trigger);
      expect(trigger.getAttribute('data-pui-style')).toContain(
        family === 'brutalist' ? 'border-black' : 'border-transparent'
      );
    });

    it('retains a populated query and focus when Enter reopens the warm service', async () => {
      const f = await mount(family);
      clickIcon(f.trigger);
      await settle();
      const input = f.root.querySelector<HTMLInputElement>('.pagefind-ui__search-input')!;
      input.value = 'Button';
      clickIcon(f.close);
      await settle();
      expect(document.activeElement).toBe(f.trigger);
      f.trigger.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        })
      );
      await settle();
      expect(f.dialog.open).toBe(true);
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe('Button');
      expect(f.buildUI).toHaveBeenCalledTimes(1);
    });

    it('consumes the opening Enter before a populated Pagefind form can act on it', async () => {
      const f = await mount(family);
      clickIcon(f.trigger);
      await settle();
      const input = f.root.querySelector<HTMLInputElement>('.pagefind-ui__search-input')!;
      const form = document.createElement('form');
      input.replaceWith(form);
      form.append(input);
      const clear = document.createElement('button');
      clear.className = 'pagefind-ui__search-clear';
      form.append(clear);
      // The installed Pagefind UI uses an untyped button and clears/blurs on
      // click; its input-only keydown guard cannot see the opener's keydown.
      const onClear = vi.fn((event: Event) => {
        event.preventDefault();
        input.value = '';
        input.blur();
      });
      clear.addEventListener('click', onClear);
      input.value = 'Button';
      clickIcon(f.close);
      await settle();
      const enter = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      f.trigger.dispatchEvent(enter);
      await settle();
      // Explicit host-default model after listener microtasks, not a claim of
      // trusted browser event coverage. Native Actions must verify this order.
      if (!enter.defaultPrevented && document.activeElement === input) clear.click();
      expect(f.dialog.open).toBe(true);
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe('Button');
      expect(onClear).not.toHaveBeenCalled();
    });

    it('keeps the dialog open if the native trigger click arrives after the outward-signal microtask', async () => {
      const { trigger, dialog, showModal } = await mount(family);
      // Model the browser's callback-cleanup checkpoint between an adapter's
      // outward signal and continued native bubbling. This is deliberately
      // split synthetic dispatch, not a claim of real trusted input coverage.
      trigger.dispatchEvent(new CustomEvent('click', { bubbles: true }));
      await settle();
      expect(dialog.open).toBe(true);
      clickIcon(trigger);
      await settle();
      expect(dialog.open).toBe(true);
      expect(showModal).toHaveBeenCalledTimes(1);
    });

    it('preserves Enter, Space, Escape/cancel, shortcuts and backdrop close', async () => {
      const { trigger, dialog, showModal } = await mount(family);
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await settle();
      expect(showModal).toHaveBeenCalledTimes(1);
      const cancel = new Event('cancel', { cancelable: true });
      dialog.dispatchEvent(cancel);
      expect(cancel.defaultPrevented).toBe(true);
      await settle();
      expect(document.activeElement).toBe(trigger);
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
      );
      trigger.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      await settle();
      expect(showModal).toHaveBeenCalledTimes(2);
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(dialog.open).toBe(false);
      for (const modifier of ['ctrlKey', 'metaKey']) {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', [modifier]: true, cancelable: true })
        );
        await settle();
        expect(dialog.open).toBe(true);
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', [modifier]: true, cancelable: true })
        );
        await settle();
        expect(dialog.open).toBe(false);
        expect(document.activeElement).toBe(trigger);
      }
    });

    it('retries once, keeps disabled/style/size props intact and returns to failure focus', async () => {
      const { trigger, retry, dialog, root, fetchIndex, holdNextProbe } = await mount(
        family,
        false
      );
      clickIcon(trigger);
      await settle();
      expect(dialog.open).toBe(true);
      expect(document.activeElement).toBe(retry);
      const beforeStyle = retry.getAttribute('data-pui-style')!;
      const release = holdNextProbe();
      retry.click();
      retry.click();
      await settle();
      expect(fetchIndex).toHaveBeenCalledTimes(2);
      expect(retry.getAttribute('aria-disabled')).toBe('true');
      expect(retry.getAttribute('data-pui-style')).toContain(
        family === 'brutalist' ? 'bg-secondary-background' : 'bg-secondary'
      );
      expect(retry.getAttribute('data-pui-style')).toContain(
        family === 'brutalist' ? 'h-9' : 'h-7'
      );
      release();
      await settle();
      expect(retry.getAttribute('aria-disabled')).toBe('false');
      expect(root.querySelector<HTMLElement>('.search-failure')!.hidden).toBe(false);
      expect(document.activeElement).toBe(retry);
      expect(retry.getAttribute('data-pui-style')).toBe(beforeStyle);
    });

    it('recovers from failed index probe and focuses the newly created query', async () => {
      const { trigger, retry, root, setProbe, fetchIndex, buildUI } = await mount(family, false);
      clickIcon(trigger);
      await settle();
      setProbe(true);
      retry.click();
      await settle();
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      expect(fetchIndex).toHaveBeenCalledTimes(2);
      expect(buildUI).toHaveBeenCalledTimes(1);
      expect(root.querySelector<HTMLElement>('.search-failure')!.hidden).toBe(true);
      expect(retry.getAttribute('aria-disabled')).toBe('false');
      expect(document.activeElement?.matches('.pagefind-ui__search-input')).toBe(true);
    });
  });
}

for (const runtime of ['react', 'vue', 'vue2', 'wc']) {
  it(`keeps the one dialog/query owner across repeated initialization and a real ${runtime} command projection`, async () => {
    const f = await mount('shadcn');
    clickIcon(f.trigger);
    await settle();
    const input = f.root.querySelector<HTMLInputElement>('.pagefind-ui__search-input')!;
    input.value = 'Button';
    const generation = f.root.dataset.searchGeneration;
    f.initialize();
    f.initialize();
    await settle();
    expect(f.root.dataset.searchGeneration).toBe(generation);
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
    );
    await vi.waitFor(() => expect(f.root.dataset.searchRuntime).toBe(runtime));
    expect(f.dialog.open).toBe(true);
    expect(f.root.querySelector('.pagefind-ui__search-input')).toBe(input);
    expect(input.value).toBe('Button');
    expect(f.buildUI).toHaveBeenCalledTimes(1);
    expect(f.fetchIndex).toHaveBeenCalledTimes(1);
    const current = f.root.querySelector<HTMLElement>(
      '[data-projection-generation-state="active"] [data-open-modal]'
    )!;
    const close = f.root.querySelector<HTMLElement>(
      '[data-projection-generation-state="active"] [data-close-modal]'
    )!;
    // Publication must expose working Button semantics on the first click;
    // waiting for those semantics here would hide an early-ready regression.
    for (const button of [current, close]) {
      expect(button.isConnected).toBe(true);
      expect(button.getAttribute('role')).toBe('button');
      expect(button.getAttribute('aria-disabled')).toBe('false');
      expect(button.tabIndex).toBe(0);
      expect(button.closest<HTMLElement>('[data-projection-generation-host]')!.inert).toBe(false);
      expect(button.dataset.projectionGeneration).toBe(f.root.dataset.searchGeneration);
    }
    clickIcon(close);
    await vi.waitFor(() => expect(f.dialog.open).toBe(false));
    await vi.waitFor(() => expect(document.activeElement).toBe(current));
    expect(current.isConnected).toBe(true);
    current.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    );
    current.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    await settle();
    expect(f.showModal).toHaveBeenCalledTimes(2);
    expect(f.buildUI).toHaveBeenCalledTimes(1);
  });
}

it('limits Enter default prevention to the live Search opener and removes it on disposal', async () => {
  const f = await mount('shadcn');
  const outside = document.createElement('input');
  document.body.append(outside);
  const key = (target: HTMLElement, value: string) => {
    const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  expect(key(outside, 'Enter').defaultPrevented).toBe(false);
  expect(key(f.trigger, 'x').defaultPrevented).toBe(false);
  expect(f.dialog.open).toBe(false);
  expect(key(f.trigger, 'Enter').defaultPrevented).toBe(true);
  await settle();
  expect(f.dialog.open).toBe(true);
  const input = f.root.querySelector<HTMLInputElement>('.pagefind-ui__search-input')!;
  // The service double has no Enter handler: Search must leave it untouched.
  expect(key(input, 'Enter').defaultPrevented).toBe(false);
  f.dispose();
  expect(key(f.trigger, 'Enter').defaultPrevented).toBe(false);
  await settle();
  expect(f.showModal).toHaveBeenCalledTimes(1);
  expect(f.dialog.open).toBe(false);
});

it('preserves pending Retry state through a real runtime swap and does not reopen after Close', async () => {
  const f = await mount('brutalist', false);
  clickIcon(f.trigger);
  await settle();
  f.setProbe(true);
  const release = f.holdNextProbe();
  f.retry.click();
  await settle();
  document.dispatchEvent(
    new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
  );
  await vi.waitFor(() => expect(f.root.dataset.searchRuntime).toBe('react'));
  const retry = f.root.querySelector<HTMLElement>(
    '[data-projection-generation-state="active"] .search-failure__retry'
  )!;
  expect(retry.getAttribute('aria-disabled')).toBe('true');
  expect(retry.getAttribute('data-pui-style')).toContain('bg-secondary-background');
  const close = f.root.querySelector<HTMLElement>(
    '[data-projection-generation-state="active"] [data-close-modal]'
  )!;
  close.click();
  await settle();
  expect(f.dialog.open).toBe(false);
  const trigger = document.activeElement;
  release();
  await settle();
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  expect(f.dialog.open).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(retry.getAttribute('aria-disabled')).not.toBe('true');
  // Close now invalidates the UI continuation, while preserving prepared modules.
  expect(f.buildUI).not.toHaveBeenCalled();
  (trigger as HTMLElement).click();
  await settle();
  expect(f.buildUI).toHaveBeenCalledTimes(1);
  expect(f.fetchIndex).toHaveBeenCalledTimes(2);
});

it('aborts pending probe and removes service listeners before late completion after disposal', async () => {
  const f = await mount('shadcn', false);
  clickIcon(f.trigger);
  await settle();
  f.setProbe(true);
  const release = f.holdNextProbe();
  f.retry.click();
  await settle();
  f.dispose();
  expect((f.fetchIndex.mock.calls[1] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(
    true
  );
  release();
  await settle();
  await f.docs.destroy();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
  await settle();
  expect(f.dialog.open).toBe(false);
  expect(f.buildUI).toHaveBeenCalledTimes(0);
  expect(f.root.querySelectorAll('[data-projection-generation-host]')).toHaveLength(0);
});

it('restores a focused command to its new view, while newer query focus wins', async () => {
  const f = await mount('shadcn');
  clickIcon(f.trigger);
  await settle();
  f.close.focus();
  document.dispatchEvent(new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'vue' } }));
  await vi.waitFor(() => expect(f.root.dataset.searchRuntime).toBe('vue'));
  await settle();
  const currentClose = f.root.querySelector<HTMLElement>(
    '[data-projection-generation-state="active"] [data-close-modal]'
  )!;
  expect(document.activeElement).toBe(currentClose);
  document.dispatchEvent(new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'vue2' } }));
  const input = f.root.querySelector<HTMLInputElement>('.pagefind-ui__search-input')!;
  input.focus();
  await vi.waitFor(() => expect(f.root.dataset.searchRuntime).toBe('vue2'));
  expect(document.activeElement).toBe(input);
});

// Native dialog.close() queues a user-interaction task, not a microtask.
// Hold that notification to exercise a permitted reopen-before-close-delivery order.
function holdNativeCloseTasks(dialog: HTMLDialogElement) {
  const tasks: Array<() => void> = [];
  dialog.close = vi.fn(() => {
    if (!dialog.open) return;
    dialog.open = false;
    tasks.push(() => dialog.dispatchEvent(new Event('close')));
  });
  return () => {
    const task = tasks.shift();
    expect(task).toBeTypeOf('function');
    task!();
  };
}

it.each(['shadcn', 'brutalist'] as const)(
  'keeps %s backdrop ownership when an older native close task arrives after reopening',
  async (family) => {
    const f = await mount(family);
    const deliverOldClose = holdNativeCloseTasks(f.dialog);
    clickIcon(f.trigger);
    await settle();
    clickIcon(f.close);
    await settle();
    expect(f.dialog.open).toBe(false);
    clickIcon(f.trigger);
    await settle();
    expect(f.dialog.open).toBe(true);
    deliverOldClose();
    await settle();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(f.dialog.open).toBe(false);
    expect(document.activeElement).toBe(f.trigger);
    expect(f.showModal).toHaveBeenCalledTimes(2);
    expect(f.buildUI).toHaveBeenCalledOnce();
  }
);

it.each(['react', 'vue', 'vue2', 'wc'])(
  'restores the current %s trigger after a stale native close notification during the next session',
  async (runtime) => {
    const f = await mount('shadcn');
    const deliverOldClose = holdNativeCloseTasks(f.dialog);
    clickIcon(f.trigger);
    await settle();
    clickIcon(f.close);
    await settle();
    clickIcon(f.trigger);
    await settle();
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
    );
    await vi.waitFor(() => expect(f.root.dataset.searchRuntime).toBe(runtime));
    const current = f.root.querySelector<HTMLElement>(
      '[data-projection-generation-state="active"] [data-open-modal]'
    )!;
    const close = f.root.querySelector<HTMLElement>(
      '[data-projection-generation-state="active"] [data-close-modal]'
    )!;
    deliverOldClose();
    await settle();
    // Real pointer activation focuses the clicked Close inside the new modal.
    close.focus();
    clickIcon(close);
    await vi.waitFor(() => expect(f.dialog.open).toBe(false));
    await vi.waitFor(() => expect(document.activeElement).toBe(current));
    expect(f.showModal).toHaveBeenCalledTimes(2);
    expect(f.buildUI).toHaveBeenCalledOnce();
    expect(f.root.querySelectorAll('.pagefind-ui__search-input')).toHaveLength(1);
  }
);

it.each(['disconnect', 'route'] as const)(
  'forces native dialog cleanup on %s before a delayed close task and ignores retired events',
  async (reason) => {
    const f = await mount('shadcn');
    const deliverRetiredClose = holdNativeCloseTasks(f.dialog);
    clickIcon(f.trigger);
    await settle();
    expect(f.dialog.open).toBe(true);
    expect(document.body.hasAttribute('data-search-modal-open')).toBe(true);
    if (reason === 'route') document.dispatchEvent(new Event('astro:before-swap'));
    else f.dispose();
    // Forced teardown cannot wait for the queued native notification.
    expect(f.dialog.open).toBe(false);
    expect(document.body.hasAttribute('data-search-modal-open')).toBe(false);
    expect(document.documentElement.hasAttribute('data-search-modal-open')).toBe(false);
    // A newer page/modal can now own the same global attributes. Neither the
    // old dialog's notification nor its old window click listener may clear them.
    document.body.setAttribute('data-search-modal-open', '');
    document.documentElement.setAttribute('data-search-modal-open', '');
    deliverRetiredClose();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(document.body.hasAttribute('data-search-modal-open')).toBe(true);
    expect(document.documentElement.hasAttribute('data-search-modal-open')).toBe(true);
    expect(f.showModal).toHaveBeenCalledOnce();
    document.body.removeAttribute('data-search-modal-open');
    document.documentElement.removeAttribute('data-search-modal-open');
  }
);

describe('module-preparation lifecycle boundaries', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const runtime of ['react', 'vue', 'vue2', 'wc']) {
      it(`keyboard intent and no-lead CtrlK work on ${family}/${runtime}`, async () => {
        const f = await mount(family);
        document.dispatchEvent(
          new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
        );
        await vi.waitFor(() => expect(f.root.dataset.searchRuntime).toBe(runtime));
        const trigger = f.root.querySelector<HTMLElement>(
          '[data-projection-generation-state="active"] [data-open-modal]'
        )!;
        expect(f.fetchIndex).not.toHaveBeenCalled();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
        await settle();
        expect(f.dialog.open).toBe(true);
        expect(f.buildUI).toHaveBeenCalledTimes(1);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
        await settle();
        trigger.blur();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        trigger.focus();
        await settle();
        expect(f.fetchIndex).toHaveBeenCalledTimes(1);
        expect(f.buildUI).toHaveBeenCalledTimes(1);
        expect(f.dialog.open).toBe(false);
      });
      it(`cold keyboard intent prepares on ${family}/${runtime}`, async () => {
        const f = await mount(family);
        document.dispatchEvent(
          new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
        );
        await vi.waitFor(() => expect(f.root.dataset.searchRuntime).toBe(runtime));
        const trigger = f.root.querySelector<HTMLElement>(
          '[data-projection-generation-state="active"] [data-open-modal]'
        )!;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        trigger.focus();
        await settle();
        expect(f.fetchIndex).toHaveBeenCalledTimes(1);
        expect(f.loadRuntime).toHaveBeenCalledTimes(1);
        expect(f.loadUI).toHaveBeenCalledTimes(1);
        expect(f.buildUI).not.toHaveBeenCalled();
      });
    }
  }
  for (const stage of ['runtime', 'UI'] as const) {
    it(`silent ${stage} timeout can recover on open; late module resolution cannot construct twice`, async () => {
      const f = await mount('shadcn');
      let resolve!: (value: unknown) => void;
      const loader = stage === 'runtime' ? f.loadRuntime : f.loadUI;
      loader.mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          }) as never
      );
      vi.useFakeTimers();
      try {
        f.trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
        await settle();
        expect(f.fetchIndex).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(5001);
        expect(f.root.querySelector<HTMLElement>('.search-failure')!.hidden).toBe(true);
        expect(f.buildUI).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(15000);
        expect(f.fetchIndex).toHaveBeenCalledTimes(1);
        clickIcon(f.trigger);
        await settle();
        expect(f.fetchIndex).toHaveBeenCalledTimes(2);
        expect(f.buildUI).toHaveBeenCalledTimes(1);
        resolve({
          PagefindUI: class {
            constructor() {
              throw new Error('Late constructor called');
            }
          },
        });
        await settle();
        expect(f.buildUI).toHaveBeenCalledTimes(1);
        expect(f.root.querySelector<HTMLElement>('.search-failure')!.hidden).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
    for (const action of ['close', 'dispose'] as const) {
      it(`${action} suppresses late ${stage} import failure`, async () => {
        const f = await mount('shadcn');
        let reject!: (error: unknown) => void;
        (stage === 'runtime' ? f.loadRuntime : f.loadUI).mockImplementationOnce(
          () =>
            new Promise((_r, j) => {
              reject = j;
            }) as never
        );
        clickIcon(f.trigger);
        await settle();
        if (action === 'close') clickIcon(f.close);
        else f.dispose();
        await settle();
        reject(new Error('offline late'));
        await settle();
        expect(f.root.querySelector<HTMLElement>('.search-failure')!.hidden).toBe(true);
        expect(f.buildUI).not.toHaveBeenCalled();
        expect(f.dialog.open).toBe(false);
      });
    }
  }
  it('public hover leave/reenter starts one new attempt after silent failure', async () => {
    const f = await mount('shadcn', false);
    f.trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await settle();
    f.setProbe(true);
    f.trigger.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    f.trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await settle();
    expect(f.fetchIndex).toHaveBeenCalledTimes(2);
    expect(f.loadUI).toHaveBeenCalledTimes(1);
    expect(f.buildUI).not.toHaveBeenCalled();
  });
});
