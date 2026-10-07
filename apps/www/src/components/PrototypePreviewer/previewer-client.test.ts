import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeSpies = vi.hoisted(() => ({
  mount: vi.fn(),
  unmount: vi.fn(),
}));
const hostMountSpies = vi.hoisted(() => ({
  release: vi.fn(),
}));
const prototypeSpies = vi.hoisted(() => ({ loadMany: vi.fn(async (_ids: string[]) => {}) }));
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
  loadPrototype: async () => {},
  loadPrototypes: prototypeSpies.loadMany,
}));
vi.mock('./demo-modules', () => ({
  loadDemo: async () => ({ type: 'demo', root: { kind: 'box', children: ['Custom demo'] } }),
}));
vi.mock('./projection-theme', () => ({
  resolveProjectionThemeSurfaceStyle: () => ({ '--pui-background': '#fff' }),
  applyProjectionThemeSurfaceStyle: () => {},
  watchProjectionThemeSurfaceStyle: (
    _family: string,
    _root: HTMLElement,
    callback: (theme: unknown) => void
  ) => {
    callback({ '--pui-background': '#fff' });
    return vi.fn();
  },
}));
vi.mock('./demo-renderer', () => ({ renderDemo: demoSpies.render }));
vi.mock('./runtimes/host-mount', () => ({
  releaseHostMount: (host: HTMLElement) => hostMountSpies.release(host),
}));
vi.mock('../site-shadcn-controls', () => ({
  initSiteShadcnControls: () => {},
  selectValue: (root: HTMLElement) => root.dataset.value ?? '',
  setSelectValue: (root: HTMLElement, value: string) => {
    root.dataset.value = value;
  },
  setSiteSelectDisabled: (root: HTMLElement, disabled: boolean) => {
    root.dataset.disabled = String(disabled);
  },
}));

import { initPreviewer } from './previewer-client';
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
    await vi.waitFor(() => expect(root.textContent).toContain('[Preview Error]'));
    expect((root as any).__previewer__.getCurrentRuntime()).toBeNull();
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
