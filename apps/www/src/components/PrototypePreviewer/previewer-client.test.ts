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
  AdapterIds: ['wc', 'vue2'],
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
    expect(demoSpies.render.mock.calls[0]![0].demo.root.prototypeId).toBe('site-preview-surface');
    expect(demoSpies.render.mock.calls[0]![0].demo.root.children[0]).toEqual({
      kind: 'box',
      children: ['Custom demo'],
    });
    expect((root as any).__previewer__.getCurrentRuntime()).toBe('wc');

    await (root as any).__previewer__.destroy();
  });

  it('does not demand a static module loader again after a direct custom loader succeeds', async () => {
    const root = createPreviewerRoot();
    const prototypeId = 'custom-loader-only-prototype';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    prototypeSpies.loadMany.mockImplementation(async (ids: string[]) => {
      if (ids.includes(prototypeId))
        throw new Error('Custom Prototype has no static module loader');
    });
    const loader =
      'data:text/javascript,' +
      encodeURIComponent('document.documentElement.dataset.runtimeCustomLoader = "loaded";');
    initPreviewer({
      root,
      prototypeId,
      loader,
      initialRuntime: 'wc',
      demoProps: { label: 'Original props' },
      runtimeList: ['wc'],
    });
    try {
      await vi.waitFor(() =>
        expect(document.documentElement.dataset.runtimeCustomLoader).toBe('loaded')
      );
      await vi.waitFor(() => expect(prototypeSpies.loadMany).toHaveBeenCalled());
      expect(prototypeSpies.loadMany).toHaveBeenCalledWith(['site-preview-surface']);
      await vi.waitFor(() => expect((root as any).__previewer__.getCurrentRuntime()).toBe('wc'));
      expect(demoSpies.render.mock.calls[0]![0].demo.root.children[0]).toEqual({
        kind: 'proto',
        prototypeId,
        props: { label: 'Original props' },
      });
    } finally {
      await (root as any).__previewer__.destroy();
      delete document.documentElement.dataset.runtimeCustomLoader;
      consoleError.mockRestore();
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
    expect(surface.props.family).toBe('shadcn');
    root.dataset.siteLibraryFamily = 'brutalist';
    finish();
    try {
      await vi.waitFor(() => expect((root as any).__previewer__.getCurrentRuntime()).toBe('wc'));
      expect(surface.props.family).toBe('brutalist');
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
