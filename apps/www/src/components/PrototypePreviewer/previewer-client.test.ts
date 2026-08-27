import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeSpies = vi.hoisted(() => ({
  mount: vi.fn(),
  unmount: vi.fn(),
}));
const hostMountSpies = vi.hoisted(() => ({
  release: vi.fn(),
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
vi.mock('./prototype-modules', () => ({ loadPrototype: async () => {} }));
vi.mock('./demo-modules', () => ({ loadDemo: async () => ({}) }));
vi.mock('./demo-renderer', () => ({ renderDemo: async () => ({ destroy: () => {} }) }));
vi.mock('./demo-types', () => ({ collectPrototypeIds: () => {} }));
vi.mock('./runtimes/host-mount', () => ({
  releaseHostMount: (host: HTMLElement) => hostMountSpies.release(host),
}));

import { initPreviewer } from './previewer-client';

function createPreviewerRoot() {
  const root = document.createElement('div');
  root.innerHTML = '<select></select><div class="host"></div>';
  document.body.appendChild(root);
  return root;
}

describe('PrototypePreviewer adapter preference synchronization', () => {
  beforeEach(() => {
    runtimeSpies.mount.mockReset();
    runtimeSpies.unmount.mockReset();
    hostMountSpies.release.mockReset();
    localStorage.clear();
    document.body.innerHTML = '';
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
