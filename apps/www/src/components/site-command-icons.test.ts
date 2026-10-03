import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import { initDocumentationSearchCommands, searchCommandParticipant } from './site-search-commands';
import { initCopyCommand } from './site-copy-command';

// Fail closed if any command's real loader graph evaluates the complete catalog.
// This is deliberately not a mock of the icon Prototype, renderer or Adapter.
const catalog = vi.hoisted(() => ({ evaluations: 0 }));
vi.mock('../../../../packages/prototypes/lucide/src/icon/icons.generated', () => {
  catalog.evaluations++;
  throw new Error('Command startup must not evaluate the full Lucide catalog');
});

// Replace CDN acquisition only. Installed frameworks, real Adapters, actual
// prototype loaders, composition and owner lifecycle all execute in Happy DOM.
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
vi.mock('./PrototypePreviewer/projection-theme', () => ({
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

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
  localStorage.clear();
  delete document.documentElement.dataset.siteLibraryFamily;
  vi.restoreAllMocks();
});

function expectSvg(host: Element, size: number) {
  expect(host.querySelectorAll('svg')).toHaveLength(1);
  const svg = host.querySelector('svg')!;
  expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  expect(svg.getAttribute('width')).toBe(String(size));
  expect(svg.getAttribute('height')).toBe(String(size));
  expect(svg.getAttribute('stroke')).toBe('currentColor');
  expect(svg.getAttribute('fill')).toBe('none');
  expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
  return svg;
}

describe('bounded command icons through real loaders and Adapters (host-unit evidence)', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    for (const family of ['shadcn', 'brutalist'] as const) {
      it(`${runtime}/${family}: Search loads only its fixed glyphs and keeps command focus/identity`, async () => {
        localStorage.setItem(PREFERRED_ADAPTER_KEY, runtime);
        const root = document.createElement('site-search');
        root.dataset.searchInitialFamily = family;
        root.innerHTML =
          '<div data-search-command-mount="open"></div><div data-search-command-mount="close"></div><div data-search-command-mount="retry"></div>';
        document.body.append(root);
        const participant = searchCommandParticipant(root);
        const callbacks = { open: vi.fn(), close: vi.fn(), retry: vi.fn() };
        participant.bind(callbacks);
        const handle = initDocumentationSearchCommands(participant);
        cleanups.push(
          () => participant.dispose(),
          () => handle.destroy()
        );
        await handle.ready;
        expect(root.dataset.searchView).toBe('ready');
        expect(root.dataset.searchRuntime).toBe(runtime);
        expect(root.dataset.searchFamily).toBe(family);
        const open = root.querySelector<HTMLElement>('[data-search-command="open"]')!;
        const close = root.querySelector<HTMLElement>('[data-search-command="close"]')!;
        const retry = root.querySelector<HTMLElement>('[data-search-command="retry"]')!;
        const search = expectSvg(open, 16);
        expect(search.querySelector('path')?.getAttribute('d')).toBe('m21 21-4.34-4.34');
        expect(search.querySelector('circle')?.getAttribute('r')).toBe('8');
        expect(search.querySelector('circle')?.getAttribute('cx')).toBe('11');
        expect(search.querySelector('circle')?.getAttribute('cy')).toBe('11');
        expect(
          [...expectSvg(close, 16).querySelectorAll('path')].map((p) => p.getAttribute('d'))
        ).toEqual(['M18 6 6 18', 'm6 6 12 12']);
        expect(retry.querySelector('svg')).toBeNull();
        participant.focus('open');
        await vi.waitFor(() => expect(document.activeElement).toBe(open));
        await vi.waitFor(() => expect(open.getAttribute('aria-disabled')).toBe('false'));
        open.click();
        await vi.waitFor(() => expect(callbacks.open).toHaveBeenCalledTimes(1));
        participant.setRetryDisabled(true);
        await vi.waitFor(() => expect(retry.getAttribute('aria-disabled')).toBe('true'));
        expect(root.querySelector('[data-search-command="open"]')).toBe(open);
        expect(document.activeElement).toBe(open);
        expect(catalog.evaluations).toBe(0);
      }, 20_000);

      it(`${runtime}/${family}: Copy preserves all four glyph states, one host and feedback lifetime`, async () => {
        localStorage.setItem(PREFERRED_ADAPTER_KEY, runtime);
        document.documentElement.dataset.siteLibraryFamily = family;
        const root = document.createElement('div');
        root.dataset.siteCopy = '';
        document.body.append(root);
        let succeed!: () => void;
        let fail!: (error: Error) => void;
        const writeText = vi.fn().mockImplementation(
          () =>
            new Promise<void>((resolve, reject) => {
              succeed = resolve;
              fail = reject;
            })
        );
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        const fallback = vi.fn().mockReturnValue(false);
        Object.defineProperty(document, 'execCommand', { configurable: true, value: fallback });
        const handle = initCopyCommand(root, () => '<payload>\n');
        cleanups.push(() => handle.destroy());
        await handle.ready;
        expect(root.dataset.copyView).toBe('ready');
        expect(root.dataset.copyRuntime).toBe(runtime);
        expect(root.dataset.copyFamily).toBe(family);
        const button = root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
        const icon = root.querySelector<HTMLElement>('[data-demo-ref="copy-icon"]')!;
        const feedback = root.querySelector('[role="status"]')!;
        const glyph = () => expectSvg(icon, 18);
        const assertStable = () => {
          expect(root.querySelector('[data-demo-ref="copy-button"]')).toBe(button);
          expect(root.querySelector('[data-demo-ref="copy-icon"]')).toBe(icon);
          expect(button.textContent).toBe('Copy code');
          expect(button.getAttribute('aria-disabled')).toBe('false');
          expect(document.activeElement).toBe(button);
          expect(root.querySelectorAll('svg')).toHaveLength(1);
        };
        await vi.waitFor(() => expect(button.dataset.copyState).toBe('idle'));
        expect(glyph().querySelector('rect')?.getAttribute('width')).toBe('14');
        expect(glyph().querySelector('path')?.getAttribute('d')).toBe(
          'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'
        );
        button.focus();
        button.click();
        await vi.waitFor(() => expect(button.dataset.copyState).toBe('pending'));
        await vi.waitFor(() =>
          expect(glyph().querySelector('path')?.getAttribute('d')).toBe(
            'M21 12a9 9 0 1 1-6.219-8.56'
          )
        );
        expect(feedback.textContent).toBe('Copying');
        assertStable();
        button.click();
        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText).toHaveBeenCalledWith('<payload>\n');
        succeed();
        await vi.waitFor(() => expect(button.dataset.copyState).toBe('success'));
        await vi.waitFor(() =>
          expect(glyph().querySelector('path')?.getAttribute('d')).toBe('M20 6 9 17l-5-5')
        );
        expect(feedback.textContent).toBe('Copied');
        assertStable();
        // Actual owner deadline, not an injected component state.
        await vi.waitFor(() => expect(button.dataset.copyState).toBe('idle'), { timeout: 2000 });
        await vi.waitFor(() => expect(glyph().querySelector('rect')).not.toBeNull());
        expect(feedback.textContent).toBe('');
        assertStable();
        button.click();
        await vi.waitFor(() => expect(button.dataset.copyState).toBe('pending'));
        fail(new Error('Injected platform write failure'));
        await vi.waitFor(() => expect(button.dataset.copyState).toBe('error'));
        await vi.waitFor(() => expect(glyph().querySelectorAll('line')).toHaveLength(2));
        expect(glyph().querySelector('circle')?.getAttribute('r')).toBe('10');
        expect(
          [...glyph().querySelectorAll('line')].map((line) =>
            ['x1', 'x2', 'y1', 'y2'].map((attribute) => line.getAttribute(attribute))
          )
        ).toEqual([
          ['12', '12', '8', '12'],
          ['12', '12.01', '16', '16'],
        ]);
        expect(feedback.textContent).toBe('Copy failed. Retry or select the code manually');
        expect(fallback).toHaveBeenCalledTimes(1);
        assertStable();
        await handle.destroy();
        button.click();
        expect(writeText).toHaveBeenCalledTimes(2);
        expect(catalog.evaluations).toBe(0);
      }, 20_000);
    }
  }

  it('keeps one Clipboard operation pending across all runtime/family replacements', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    let succeed!: () => void;
    const writeText = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          succeed = resolve;
        })
    );
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const handle = initCopyCommand(root, () => 'same pending payload');
    cleanups.push(() => handle.destroy());
    await handle.ready;
    let button = root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
    await vi.waitFor(() => expect(button.dataset.copyState).toBe('idle'));
    button.click();
    await vi.waitFor(() => expect(button.dataset.copyState).toBe('pending'));
    const owner = handle.owner;
    for (const [runtime, family] of [
      ['react', 'brutalist'],
      ['vue', 'shadcn'],
      ['vue2', 'brutalist'],
      ['wc', 'shadcn'],
    ] as const) {
      const old = button;
      document.documentElement.dataset.siteLibraryFamily = family;
      document.dispatchEvent(
        new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: runtime } })
      );
      await vi.waitFor(() => {
        expect(root.dataset.copyRuntime).toBe(runtime);
        expect(root.dataset.copyFamily).toBe(family);
        expect(root.dataset.copyView).toBe('ready');
      });
      button = root.querySelector<HTMLElement>('[data-demo-ref="copy-button"]')!;
      expect(button).not.toBe(old);
      expect(old.isConnected).toBe(false);
      expect(handle.owner).toBe(owner);
      await vi.waitFor(() => expect(button.dataset.copyState).toBe('pending'));
      await vi.waitFor(() =>
        expect(expectSvg(button, 18).querySelector('path')?.getAttribute('d')).toBe(
          'M21 12a9 9 0 1 1-6.219-8.56'
        )
      );
      old.click();
      button.click();
      expect(writeText).toHaveBeenCalledTimes(1);
    }
    succeed();
    await vi.waitFor(() => expect(button.dataset.copyState).toBe('success'));
    await vi.waitFor(() =>
      expect(expectSvg(button, 18).querySelector('path')?.getAttribute('d')).toBe('M20 6 9 17l-5-5')
    );
    expect(root.querySelector('[role="status"]')?.textContent).toBe('Copied');
    expect(catalog.evaluations).toBe(0);
  }, 20_000);
});
