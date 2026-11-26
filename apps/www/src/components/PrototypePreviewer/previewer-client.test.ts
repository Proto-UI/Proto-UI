import { observePreviewerRemoval } from './previewer-removal';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeSpies = vi.hoisted(() => ({
  mount: vi.fn(),
  unmount: vi.fn(),
}));
const hostMountSpies = vi.hoisted(() => ({
  release: vi.fn(),
}));
const prototypeSpies = vi.hoisted(() => ({ loadMany: vi.fn(async (_ids: string[]) => {}) }));
const loadPrototypeSpy = vi.hoisted(() => vi.fn(async (_prototypeId: string) => true));
const demoSpies = vi.hoisted(() => ({
  render: vi.fn(),
}));

vi.mock('./runtimes/registry', () => ({
  runtimeLoaders: {
    wc: async () => ({
      id: 'wc',
      label: 'Web Components',
      mount: (host: HTMLElement) => runtimeSpies.mount('wc', host),
      unmount: (host: HTMLElement) => runtimeSpies.unmount('wc', host),
    }),
    vue2: async () => ({
      id: 'vue2',
      label: 'Vue 2',
      mount: (host: HTMLElement) => runtimeSpies.mount('vue2', host),
      unmount: (host: HTMLElement) => runtimeSpies.unmount('vue2', host),
    }),
  },
}));

vi.mock('./registry', () => ({ getPrototype: () => ({}) }));
vi.mock('./prototype-modules', () => ({
  loadPrototype: (prototypeId: string) => loadPrototypeSpy(prototypeId),
  loadPrototypes: prototypeSpies.loadMany,
}));
vi.mock('./demo-modules', () => ({
  loadDemo: async () => ({ type: 'demo', root: { kind: 'box', children: ['Custom demo'] } }),
}));
vi.mock('./projection-theme', async (original) => {
  const current = await original<typeof import('./projection-theme')>();
  return {
    resolveProjectionThemeSurfaceStyle: () => ({ '--pui-background': '#fff' }),
    scheduleProjectionThemeRead: current.scheduleProjectionThemeRead,
    applyProjectionThemeSurfaceStyle: () => {},
    watchProjectionThemeSurfaceStyle: (
      _family: string,
      _root: HTMLElement,
      callback: (theme: unknown) => void
    ) => {
      callback({ '--pui-background': '#fff' });
      return vi.fn();
    },
  };
});
vi.mock('./demo-renderer', () => ({ renderDemo: demoSpies.render }));
vi.mock('./runtimes/host-mount', () => ({
  releaseHostMount: (host: HTMLElement) => hostMountSpies.release(host),
}));
vi.mock('../site-shadcn-controls', async (original) => {
  const current = await original<typeof import('../site-shadcn-controls')>();
  return {
    ...current,
    initSiteShadcnControls: () => {},
    selectValue: (root: HTMLElement) => root.dataset.value ?? '',
    setSelectValue: (root: HTMLElement, value: string) => {
      root.dataset.value = value;
    },
    setSiteSelectDisabled: (root: HTMLElement, disabled: boolean) => {
      root.dataset.disabled = String(disabled);
    },
  };
});

import { initPreviewer } from './previewer-client';
import * as projectionTheme from './projection-theme';
import * as previewSurface from './runtime-preview-surface';
import { initAdapterSelects } from '../adapter-preference';
import { initSiteShadcnControls, selectValue, type SiteSelectRoot } from '../site-shadcn-controls';

function createPreviewerRoot() {
  const root = document.createElement('div');
  root.innerHTML = '<select></select><div class="host"></div>';
  document.body.appendChild(root);
  return root;
}

function createProjectedPreviewerRoot() {
  const root = document.createElement('div');
  root.innerHTML = `<div data-adapter-select>
    <wc-shadcn-select-root
      data-site-select-root
      data-adapter-select-root
      data-site-initial-value="wc"
    >
      <wc-shadcn-select-trigger><wc-shadcn-select-value></wc-shadcn-select-value></wc-shadcn-select-trigger>
      <wc-shadcn-select-content>
        <wc-shadcn-select-item data-value="wc" data-text-value="Web Components">Web Components</wc-shadcn-select-item>
        <wc-shadcn-select-item data-value="vue2" data-text-value="Vue 2">Vue 2</wc-shadcn-select-item>
      </wc-shadcn-select-content>
    </wc-shadcn-select-root>
  </div><div class="host"></div>`;
  document.body.appendChild(root);
  initSiteShadcnControls(document);
  initAdapterSelects(document);
  return root;
}

describe('PrototypePreviewer adapter preference synchronization', () => {
  beforeEach(() => {
    prototypeSpies.loadMany.mockReset().mockResolvedValue(undefined);
    loadPrototypeSpy.mockReset().mockResolvedValue(true);
    runtimeSpies.mount.mockReset();
    runtimeSpies.unmount.mockReset();
    hostMountSpies.release.mockReset();
    demoSpies.render
      .mockReset()
      .mockImplementation(async ({ runtime, host }: { runtime: string; host: HTMLElement }) => {
        await runtimeSpies.mount(runtime, host);
        return { destroy: () => runtimeSpies.unmount(runtime, host) };
      });
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('does not adopt or rewrite a compiled target selector as the legacy runtime selector', async () => {
    const root = createPreviewerRoot();
    root.innerHTML =
      '<pui-browser-compiler><select data-compiler-target><option value="web-component-source-v1">Web Components</option><option value="react-dom-source-v1">React 19</option></select></pui-browser-compiler><div class="host"></div>';
    const target = root.querySelector<HTMLSelectElement>('[data-compiler-target]')!;
    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'react'],
    });
    await vi.waitFor(() => expect(runtimeSpies.mount).toHaveBeenCalledTimes(1));
    expect([...target.options].map((option) => option.value)).toEqual([
      'web-component-source-v1',
      'react-dom-source-v1',
    ]);
    target.value = 'react-dom-source-v1';
    target.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    expect(runtimeSpies.mount).toHaveBeenCalledTimes(1);
    await (root as any).__previewer__?.destroy();
    root.remove();
  });

  it('skips owner checks on add-only deliveries and still checks removal and reinsertion', async () => {
    const container = document.body.appendChild(document.createElement('section'));
    const preview = container.appendChild(document.createElement('div'));
    const destroy = vi.fn();
    const check = vi.fn(() => {
      if (!document.body.contains(preview)) destroy();
    });
    const stop = observePreviewerRemoval(document.body, check);
    try {
      container.appendChild(document.createElement('span'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(check).not.toHaveBeenCalled();

      preview.remove();
      container.appendChild(preview);
      await vi.waitFor(() => expect(check).toHaveBeenCalledTimes(1));
      expect(destroy).not.toHaveBeenCalled();

      container.remove();
      await vi.waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
      expect(check).toHaveBeenCalledTimes(2);
    } finally {
      stop();
      container.remove();
    }
  });

  it('shares body removal observation and retires only the detached preview', async () => {
    const first = createPreviewerRoot();
    const second = createPreviewerRoot();
    const NativeObserver = MutationObserver;
    const observeBody = vi.fn();
    let deliverRemoval!: () => void;
    vi.stubGlobal(
      'MutationObserver',
      class extends NativeObserver {
        constructor(callback: MutationCallback) {
          super(callback);
          const observe = this.observe.bind(this);
          this.observe = (target, options) => {
            if (target !== document.body || !options?.childList || !options.subtree) {
              observe(target, options);
              return;
            }
            // Happy DOM can collect the weak mutation listener before delivery.
            // Control the body batch while retaining the actual DOM changes.
            observeBody(target, options);
            deliverRemoval = () =>
              callback(
                [first, second].map(
                  (root) =>
                    ({
                      type: 'childList',
                      target,
                      removedNodes: [root],
                    }) as unknown as MutationRecord
                ),
                this
              );
          };
        }
      }
    );
    try {
      for (const root of [first, second]) {
        initPreviewer({
          root,
          prototypeId: 'demo',
          initialRuntime: 'wc',
          demoProps: {},
          runtimeList: ['wc'],
        });
      }
      await vi.waitFor(() => expect(runtimeSpies.mount).toHaveBeenCalledTimes(2));
      expect(observeBody).toHaveBeenCalledTimes(1);
      expect(observeBody).toHaveBeenCalledWith(document.body, {
        childList: true,
        subtree: true,
      });

      first.remove();
      second.remove();
      document.body.appendChild(second);
      deliverRemoval();
      await vi.waitFor(() => expect(runtimeSpies.unmount).toHaveBeenCalledTimes(1));
      expect(runtimeSpies.unmount.mock.lastCall?.[0]).toBe('wc');
      expect(runtimeSpies.unmount.mock.lastCall?.[1]).toBe(first.querySelector('.host'));
    } finally {
      vi.unstubAllGlobals();
      await (first as any).__previewer__?.destroy();
      await (second as any).__previewer__?.destroy();
      first.remove();
      second.remove();
    }
  });

  it('retains the original live loading status through module loading and renderer preparation', async () => {
    const root = createPreviewerRoot();
    const host = root.querySelector<HTMLElement>('.host')!;
    host.parentElement!.classList.add('proto-previewer__preview');
    const status = document.createElement('div');
    status.className = 'proto-previewer__skeleton';
    status.setAttribute('role', 'status');
    status.textContent = 'Loading interactive preview…';
    host.append(status);
    let releaseModules!: () => void;
    let releaseRender!: () => void;
    prototypeSpies.loadMany.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseModules = resolve;
        })
    );
    demoSpies.render.mockImplementationOnce(async ({ host }: { host: HTMLElement }) => {
      host.replaceChildren(document.createElement('button'));
      await new Promise<void>((resolve) => {
        releaseRender = resolve;
      });
      return { destroy: vi.fn() };
    });
    initPreviewer({
      root,
      demoId: 'demo-custom-preview',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc'],
    });
    try {
      await vi.waitFor(() => expect(prototypeSpies.loadMany).toHaveBeenCalled());
      expect(status.isConnected).toBe(true);
      expect(root.querySelector('[role="status"]')).toBe(status);
      expect(host.inert).toBe(true);
      releaseModules();
      await vi.waitFor(() => expect(demoSpies.render).toHaveBeenCalled());
      expect(status.isConnected).toBe(true);
      expect(host.inert).toBe(true);
      releaseRender();
      await vi.waitFor(() => expect((root as any).__previewer__.getCurrentRuntime()).toBe('wc'));
      expect(status.isConnected).toBe(false);
      expect(host.inert).toBe(false);
      expect(host.hasAttribute('data-previewer-startup-pending')).toBe(false);
      host.inert = true; // Later owners are not overwritten by repeated cleanup.
      await (root as any).__previewer__.destroy();
      expect(host.inert).toBe(true);
    } finally {
      releaseModules?.();
      releaseRender?.();
      await (root as any).__previewer__.destroy();
    }
  });

  it('reads every startup theme watcher before publishing either owner appearance', async () => {
    const roots = [createPreviewerRoot(), createPreviewerRoot()];
    const order: string[] = [];
    const appearances: ReturnType<typeof vi.fn>[] = [];
    const stops: ReturnType<typeof vi.fn>[] = [];
    roots.forEach((root, index) => {
      root.dataset.siteLibraryFamily = 'shadcn';
      root.dataset.themeSample = `initial-${index}`;
      root.querySelector('.host')!.innerHTML =
        '<div class="proto-previewer__skeleton" role="status">Loading</div>';
    });
    const watch = vi
      .spyOn(projectionTheme, 'watchProjectionThemeSurfaceStyle')
      .mockImplementation((_family, scope, callback) => {
        const index = roots.findIndex((root) => root === scope);
        order.push(`read ${index}`);
        callback({ '--pui-background': (scope as HTMLElement).dataset.themeSample! });
        const stop = vi.fn();
        stops.push(stop);
        return stop;
      });
    const originalCreate = previewSurface.createRuntimePreviewSurface;
    const create = vi
      .spyOn(previewSurface, 'createRuntimePreviewSurface')
      .mockImplementation((...args) => {
        const surface = originalCreate(...args);
        const index = appearances.length;
        const appearance = vi.fn(async () => {
          order.push(`write ${index}`);
          if (index === 0) roots[1]!.dataset.themeSample = 'after-first-publication';
        });
        surface.setAppearance = appearance;
        appearances.push(appearance);
        return surface;
      });
    try {
      for (const root of roots)
        initPreviewer({
          root,
          demoId: 'demo-custom-preview',
          initialRuntime: 'wc',
          demoProps: {},
          runtimeList: ['wc'],
        });
      await vi.waitFor(() =>
        expect(roots.map((root) => (root as any).__previewer__.getCurrentRuntime())).toEqual([
          'wc',
          'wc',
        ])
      );
      expect(order).toEqual(['read 0', 'read 1', 'write 0', 'write 1']);
      expect(appearances[1]).toHaveBeenCalledWith('shadcn', {
        '--pui-background': 'initial-1',
      });
      expect(roots[1]!.dataset.themeSample).toBe('after-first-publication');
    } finally {
      for (const root of roots) await (root as any).__previewer__?.destroy();
      watch.mockRestore();
      create.mockRestore();
    }
    expect(stops).toHaveLength(2);
    for (const stop of stops) expect(stop).toHaveBeenCalledOnce();
  });

  it.each(['commit', 'destroy', 'supersede', 'failure'] as const)(
    'owns a live theme watcher while the initial appearance is pending: %s',
    async (outcome) => {
      const root = createPreviewerRoot();
      root.dataset.siteLibraryFamily = 'shadcn';
      const host = root.querySelector<HTMLElement>('.host')!;
      host.innerHTML = '<div class="proto-previewer__skeleton" role="status">Loading</div>';
      const status = host.firstElementChild!;
      const callbacks: Array<
        Parameters<typeof projectionTheme.watchProjectionThemeSurfaceStyle>[2]
      > = [];
      const stops: ReturnType<typeof vi.fn>[] = [];
      const appearances: ReturnType<typeof vi.fn>[] = [];
      let release!: () => void;
      let fail!: (error: Error) => void;
      const pending = new Promise<void>((resolve, reject) => {
        release = resolve;
        fail = reject;
      });
      const watch = vi
        .spyOn(projectionTheme, 'watchProjectionThemeSurfaceStyle')
        .mockImplementation((_family, _scope, callback) => {
          callbacks.push(callback);
          callback({ '--pui-background': 'initial-theme' });
          const stop = vi.fn();
          stops.push(stop);
          return stop;
        });
      const originalCreate = previewSurface.createRuntimePreviewSurface;
      const create = vi
        .spyOn(previewSurface, 'createRuntimePreviewSurface')
        .mockImplementation((...args) => {
          const surface = originalCreate(...args);
          const appearance = vi.fn(async () => {});
          if (appearances.length === 0) appearance.mockImplementationOnce(() => pending);
          surface.setAppearance = appearance;
          appearances.push(appearance);
          return surface;
        });
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      initPreviewer({
        root,
        demoId: 'demo-custom-preview',
        initialRuntime: 'wc',
        demoProps: {},
        runtimeList: ['wc', 'vue2'],
      });
      try {
        await vi.waitFor(() => expect(appearances[0]).toHaveBeenCalledOnce());
        expect(callbacks).toHaveLength(1);
        expect((root as any).__previewer__.getCurrentRuntime()).toBeNull();
        expect(status.isConnected).toBe(true);
        expect(host.inert).toBe(true);
        callbacks[0]!({ '--pui-background': 'during-preparation' });
        expect(appearances[0]).toHaveBeenCalledOnce();

        if (outcome === 'destroy') {
          await (root as any).__previewer__.destroy();
          expect(stops[0]).toHaveBeenCalled();
        } else if (outcome === 'supersede') {
          document.dispatchEvent(
            new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue2' } })
          );
          await vi.waitFor(() =>
            expect((root as any).__previewer__.getCurrentRuntime()).toBe('vue2')
          );
          expect(stops[0]).toHaveBeenCalled();
        }
        if (outcome === 'failure') fail(new Error('controlled initial appearance failure'));
        else release();

        if (outcome === 'commit') {
          await vi.waitFor(() =>
            expect((root as any).__previewer__.getCurrentRuntime()).toBe('wc')
          );
          expect(appearances[0]).toHaveBeenLastCalledWith('shadcn', {
            '--pui-background': 'during-preparation',
          });
          expect(status.isConnected).toBe(false);
          expect(host.inert).toBe(false);
          callbacks[0]!({ '--pui-background': 'after-commit' });
          expect(appearances[0]).toHaveBeenLastCalledWith('shadcn', {
            '--pui-background': 'after-commit',
          });
          expect(errors).not.toHaveBeenCalled();
        } else {
          await vi.waitFor(() => expect(runtimeSpies.unmount).toHaveBeenCalledWith('wc', host));
          expect(stops[0]).toHaveBeenCalled();
          callbacks[0]!({ '--pui-background': 'retired-owner-theme' });
          expect(appearances[0]).toHaveBeenCalledOnce();
          expect((root as any).__previewer__.getCurrentRuntime()).toBe(
            outcome === 'supersede' ? 'vue2' : null
          );
          if (outcome === 'failure')
            expect(host.textContent).toContain('controlled initial appearance failure');
          else expect(errors).not.toHaveBeenCalled();
        }
      } finally {
        release();
        await (root as any).__previewer__.destroy();
        watch.mockRestore();
        create.mockRestore();
        errors.mockRestore();
      }
    }
  );

  it.each(['failure', 'destroy'] as const)(
    'releases the initial status on %s without retaining a busy shell',
    async (outcome) => {
      const root = createPreviewerRoot();
      const host = root.querySelector<HTMLElement>('.host')!;
      host.innerHTML = '<div class="proto-previewer__skeleton" role="status">Loading</div>';
      let rejectModules!: (error: Error) => void;
      prototypeSpies.loadMany.mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectModules = reject;
          })
      );
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      initPreviewer({
        root,
        demoId: 'demo-custom-preview',
        initialRuntime: 'wc',
        demoProps: {},
        runtimeList: ['wc'],
      });
      try {
        await vi.waitFor(() => expect(prototypeSpies.loadMany).toHaveBeenCalled());
        expect(root.querySelector('[role="status"]')?.isConnected).toBe(true);
        if (outcome === 'destroy') await (root as any).__previewer__.destroy();
        rejectModules(new Error('controlled module failure'));
        if (outcome === 'failure')
          await vi.waitFor(() => expect(host.textContent).toContain('controlled module failure'));
        expect(root.querySelector('[role="status"]')).toBeNull();
        expect(host.inert).toBe(false);
        expect(root.hasAttribute('data-previewer-startup-shell')).toBe(false);
        expect(host.hasAttribute('data-previewer-startup-pending')).toBe(false);
      } finally {
        await (root as any).__previewer__.destroy();
        log.mockRestore();
      }
    }
  );

  it('keeps an uncataloged demo on the legacy demo renderer', async () => {
    const root = createPreviewerRoot();

    initPreviewer({
      root,
      demoId: 'demo-custom-preview',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });

    await vi.waitFor(() => expect(demoSpies.render).toHaveBeenCalledTimes(1));
    expect(demoSpies.render).toHaveBeenCalledWith(
      expect.objectContaining({ runtime: 'wc', host: root.querySelector('.host') })
    );
    expect(demoSpies.render.mock.calls[0]![0].demo.root.className).toBe(
      'pui-runtime-preview-composition'
    );
    expect(demoSpies.render.mock.calls[0]![0].demo.root.children[1].children[0]).toEqual({
      kind: 'box',
      children: ['Custom demo'],
    });
    expect((root as any).__previewer__.getCurrentRuntime()).toBe('wc');

    await (root as any).__previewer__.destroy();
  });

  it('ignores legacy data-loader URLs and keeps the static prototype module path', async () => {
    const root = createPreviewerRoot();
    root.dataset.loader =
      'data:text/javascript,' +
      encodeURIComponent('document.documentElement.dataset.runtimeCustomLoader = "loaded";');
    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc'],
    });
    try {
      await vi.waitFor(() => expect(demoSpies.render).toHaveBeenCalled());
      expect(document.documentElement.dataset.runtimeCustomLoader).toBeUndefined();
      expect(prototypeSpies.loadMany).toHaveBeenCalledWith([]);
    } finally {
      await (root as any).__previewer__.destroy();
    }
  });

  it('uses the persisted page-level adapter preference for its first mount', async () => {
    localStorage.setItem('preferred-prototypes-adapter', 'vue2');
    const root = createPreviewerRoot();

    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });

    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('vue2', expect.anything())
    );
    expect((root.querySelector('select') as HTMLSelectElement).value).toBe('vue2');
    await (root as any).__previewer__.destroy();
    root.remove();
  });

  it('aligns the projected selector with a non-wc initial runtime', async () => {
    const root = createProjectedPreviewerRoot();

    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'vue2',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });

    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('vue2', expect.anything())
    );
    expect(selectValue(root.querySelector('[data-adapter-select-root]') as SiteSelectRoot)).toBe(
      'vue2'
    );
    await (root as any).__previewer__.destroy();
  });

  it('routes a projected selection through one page-level remount path', async () => {
    const root = createProjectedPreviewerRoot();
    const select = root.querySelector('[data-adapter-select-root]') as SiteSelectRoot;
    let resolveRemount: (() => void) | undefined;
    const remount = new Promise<void>((resolve) => {
      resolveRemount = resolve;
    });

    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });
    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('wc', expect.anything())
    );
    runtimeSpies.mount.mockClear();
    runtimeSpies.mount.mockImplementation((id: string) => (id === 'vue2' ? remount : undefined));

    select.dispatchEvent(
      new CustomEvent('valueChange', { detail: { value: 'vue2' }, bubbles: true })
    );

    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('vue2', expect.anything())
    );
    expect(select.dataset.disabled).toBe('true');
    expect(runtimeSpies.mount).toHaveBeenCalledTimes(1);
    resolveRemount?.();
    await vi.waitFor(() => expect(select.dataset.disabled).toBe('false'));
    await (root as any).__previewer__.destroy();
  });

  it('remounts when the page-level adapter selector broadcasts a compatible runtime', async () => {
    const root = createPreviewerRoot();

    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });
    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('wc', expect.anything())
    );

    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue2' } })
    );

    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('vue2', expect.anything())
    );
    expect(runtimeSpies.unmount).toHaveBeenCalled();
    expect((root.querySelector('select') as HTMLSelectElement).value).toBe('vue2');
    await (root as any).__previewer__.destroy();
    root.remove();
  });

  it('commits the latest generic family when it changes while the renderer is pending', async () => {
    let finish!: () => void;
    runtimeSpies.mount.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const root = createPreviewerRoot();
    root.dataset.siteLibraryFamily = 'shadcn';
    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });
    await vi.waitFor(() => expect(demoSpies.render).toHaveBeenCalledTimes(1));
    const surface = demoSpies.render.mock.calls[0]![0].demo.root;
    expect(surface.className).toBe('pui-runtime-preview-composition');
    root.dataset.siteLibraryFamily = 'brutalist';
    finish();
    try {
      await vi.waitFor(() => expect((root as any).__previewer__.getCurrentRuntime()).toBe('wc'));
      expect(root.dataset.siteLibraryFamily).toBe('brutalist');
      expect(demoSpies.render).toHaveBeenCalledTimes(1); // Mock never executes setup; real family/state lease is covered by runtime-preview-surface.test.ts.
    } finally {
      await (root as any).__previewer__.destroy();
    }
  });

  it('does not let a stale runtime completion replace the current runtime', async () => {
    let resolveFirstMount: (() => void) | undefined;
    const firstMount = new Promise<void>((resolve) => {
      resolveFirstMount = resolve;
    });
    runtimeSpies.mount.mockImplementation((id: string) => (id === 'wc' ? firstMount : undefined));
    const root = createPreviewerRoot();

    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });
    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('wc', expect.anything())
    );

    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue2' } })
    );
    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('vue2', expect.anything())
    );

    resolveFirstMount?.();
    await vi.waitFor(() => expect((root as any).__previewer__.getCurrentRuntime()).toBe('vue2'));

    await (root as any).__previewer__.destroy();
    root.remove();
  });

  it('does not remount when duplicate adapter events target the active runtime', async () => {
    const root = createPreviewerRoot();

    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });
    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('wc', expect.anything())
    );
    runtimeSpies.mount.mockClear();

    document.dispatchEvent(new CustomEvent('proto-adapter:change', { detail: { adapter: 'wc' } }));
    await Promise.resolve();
    expect(runtimeSpies.mount).not.toHaveBeenCalled();

    await (root as any).__previewer__.reload();
    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('wc', expect.anything())
    );
    await (root as any).__previewer__.destroy();
    root.remove();
  });

  it('lets a newer adapter event replace an in-flight runtime request', async () => {
    let resolveVue2Mount: (() => void) | undefined;
    const vue2Mount = new Promise<void>((resolve) => {
      resolveVue2Mount = resolve;
    });
    runtimeSpies.mount.mockImplementation((id: string) => (id === 'vue2' ? vue2Mount : undefined));
    const root = createPreviewerRoot();

    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });
    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('wc', expect.anything())
    );

    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue2' } })
    );
    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('vue2', expect.anything())
    );

    document.dispatchEvent(new CustomEvent('proto-adapter:change', { detail: { adapter: 'wc' } }));
    resolveVue2Mount?.();

    await vi.waitFor(() => expect(runtimeSpies.mount).toHaveBeenCalledTimes(3));
    expect((root as any).__previewer__.getCurrentRuntime()).toBe('wc');
    await (root as any).__previewer__.destroy();
    root.remove();
  });

  it('clears the active runtime before a failed remount', async () => {
    runtimeSpies.mount.mockImplementation((id: string) => {
      if (id === 'vue2') throw new Error('vue2 failed');
    });
    const root = createPreviewerRoot();

    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });
    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('wc', expect.anything())
    );

    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue2' } })
    );
    await vi.waitFor(() =>
      expect(root.querySelector('[data-preview-recovery="error"]')).not.toBeNull()
    );
    expect(root.textContent).toContain('vue2 failed');
    expect((root as any).__previewer__.getCurrentRuntime()).toBeNull();
    await (root as any).__previewer__.destroy();
    root.remove();
  });

  it('offers a recovery path when a lazy-loaded chunk fails to load', async () => {
    loadPrototypeSpy.mockRejectedValue(
      new Error(
        '[PrototypePreviewer] 加载原型模块 "demo" 失败: Failed to fetch dynamically imported module: /_astro/demo.hash.js'
      )
    );
    const root = createPreviewerRoot();

    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });

    const recovery = await vi.waitFor(() => {
      const found = root.querySelector<HTMLElement>('[data-preview-recovery="chunk"]');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(recovery.textContent).toContain('Prototype module failed to load');
    expect(recovery.textContent).toContain('lazy-loaded chunk');
    const buttons = Array.from(recovery.querySelectorAll('button'));
    // A failed dynamic import is cached by URL in the browser's module map, so
    // re-importing the same build-bound URL cannot recover it. Only a fresh
    // document can, so the surface must not offer an ineffective retry.
    expect(buttons.map((button) => button.textContent)).toEqual(['Reload page']);
    // The recovery labels must not rely on an inherited foreground: a fixed
    // background with `color: inherit` is unreadable in the dark theme.
    for (const button of buttons) {
      expect(button.style.color).toContain('var(--color-');
      expect(button.style.background).toContain('var(--color-');
    }
    await (root as any).__previewer__.destroy();
    root.remove();
  });

  it('keeps unrelated preview failures free of the chunk recovery controls', async () => {
    runtimeSpies.mount.mockImplementation((id: string) => {
      if (id === 'vue2') throw new Error('vue2 failed');
    });
    const root = createPreviewerRoot();

    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });
    await vi.waitFor(() =>
      expect(runtimeSpies.mount).toHaveBeenCalledWith('wc', expect.anything())
    );

    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue2' } })
    );
    await vi.waitFor(() =>
      expect(root.querySelector('[data-preview-recovery="error"]')).not.toBeNull()
    );
    expect(root.querySelectorAll('[data-preview-recovery="chunk"] button')).toHaveLength(0);
    await (root as any).__previewer__.destroy();
    root.remove();
  });

  it('invalidates the host before every switch and terminal destroy', async () => {
    const root = createPreviewerRoot();
    const host = root.querySelector<HTMLElement>('.host')!;

    initPreviewer({
      root,
      prototypeId: 'demo',
      initialRuntime: 'wc',
      demoProps: {},
      runtimeList: ['wc', 'vue2'],
    });
    await vi.waitFor(() => expect(runtimeSpies.mount).toHaveBeenCalled());

    hostMountSpies.release.mockClear();
    document.dispatchEvent(
      new CustomEvent('proto-adapter:change', { detail: { adapter: 'vue2' } })
    );
    await vi.waitFor(() => expect(hostMountSpies.release).toHaveBeenCalledWith(host));

    hostMountSpies.release.mockClear();
    await (root as any).__previewer__.destroy();
    expect(hostMountSpies.release).toHaveBeenCalledWith(host);
    root.remove();
  });
});
