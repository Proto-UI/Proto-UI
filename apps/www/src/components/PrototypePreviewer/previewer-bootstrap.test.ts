import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initPreviewerBootstrap } from './previewer-bootstrap';

let dispose: (() => void) | undefined;
let callbacks: Array<(entries: Array<{ isIntersecting: boolean }>) => void>;
let disconnects: Array<ReturnType<typeof vi.fn>>;
beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  callbacks = [];
  disconnects = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        callbacks.push(callback);
        disconnects.push(this.disconnect);
      }
    }
  );
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function root() {
  const element = document.createElement('section');
  element.className = 'proto-previewer';
  element.dataset.previewerId = 'lazy-card';
  element.dataset.demoId = 'demo-shadcn-button';
  element.dataset.lazy = 'true';
  document.body.append(element);
  return element;
}
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};

describe('RuntimeBox lazy bootstrap lifetime', () => {
  it('defers the client and sees the latest preference when the lazy card really mounts', async () => {
    root();
    const seen: Array<string | null> = [];
    const initPreviewer = vi.fn(() => {
      seen.push(localStorage.getItem('preferred-prototypes-adapter'));
    });
    const load = vi.fn(async () => ({ initPreviewer }));
    dispose = initPreviewerBootstrap(document, load);
    document.dispatchEvent(new Event('astro:page-load'));
    expect(load).not.toHaveBeenCalled();
    localStorage.setItem('preferred-prototypes-adapter', 'vue2');
    callbacks[0]!([{ isIntersecting: true }]);
    await flush();
    expect(seen).toEqual(['vue2']);
    expect(disconnects[0]).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate observers or mounts on repeated bootstrap/page-load', async () => {
    const element = root();
    const initPreviewer = vi.fn(() => {
      element.dataset.inited = '1';
    });
    const load = vi.fn(async () => ({ initPreviewer }));
    dispose = initPreviewerBootstrap(document, load);
    expect(initPreviewerBootstrap(document, load)).toBe(dispose);
    document.dispatchEvent(new Event('astro:page-load'));
    document.dispatchEvent(new Event('astro:page-load'));
    expect(callbacks).toHaveLength(1);
    callbacks[0]!([{ isIntersecting: true }]);
    callbacks[0]!([{ isIntersecting: true }]);
    await flush();
    expect(initPreviewer).toHaveBeenCalledTimes(1);
  });

  it('revokes an import completion on Astro swap even while the old root is still connected', async () => {
    const element = root();
    const initPreviewer = vi.fn();
    let resolve!: (client: { initPreviewer: typeof initPreviewer }) => void;
    const load = vi.fn(
      () =>
        new Promise<{ initPreviewer: typeof initPreviewer }>((done) => {
          resolve = done;
        })
    );
    dispose = initPreviewerBootstrap(document, load);
    document.dispatchEvent(new Event('astro:page-load'));
    callbacks[0]!([{ isIntersecting: true }]);
    document.dispatchEvent(new Event('astro:before-swap'));
    expect(element.isConnected).toBe(true);
    resolve({ initPreviewer });
    await flush();
    expect(initPreviewer).not.toHaveBeenCalled();
    expect(element.dataset.mounting).toBeUndefined();
  });

  it('disconnects a never-visible removed card and calls a mounted owner cleanup only once', async () => {
    const element = root();
    const destroy = vi.fn();
    const initPreviewer = vi.fn();
    dispose = initPreviewerBootstrap(document, async () => ({ initPreviewer }));
    document.dispatchEvent(new Event('astro:page-load'));
    (element as HTMLElement & { __previewer__: unknown }).__previewer__ = { destroy };
    element.remove();
    await vi.waitFor(() => expect(disconnects[0]).toHaveBeenCalledTimes(1));
    callbacks[0]!([{ isIntersecting: true }]);
    await flush();
    expect(initPreviewer).not.toHaveBeenCalled();
    dispose();
    dispose();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

function panel(adapter: string, visible: boolean, lazy = false) {
  const container = document.createElement('div');
  container.dataset.adapterPanel = adapter;
  container.style.display = visible ? '' : 'none';
  document.body.append(container);
  const element = root();
  element.dataset.lazy = String(lazy);
  container.append(element);
  return { container, element };
}

describe('adapter panel first activation', () => {
  it('loads only visible eager panels, later activates a shown panel, and preserves mounted state', async () => {
    const wc = panel('wc', true);
    const react = panel('react', false);
    panel('vue', false);
    panel('vue2', false);
    const destroy = vi.fn();
    const initPreviewer = vi.fn(
      ({ root: element }: Parameters<typeof import('./previewer-client').initPreviewer>[0]) => {
        element.dataset.inited = '1';
        (element as HTMLElement & { __previewer__: unknown }).__previewer__ = { destroy };
      }
    );
    const load = vi.fn(async () => ({ initPreviewer }));
    dispose = initPreviewerBootstrap(document, load);
    document.dispatchEvent(new Event('astro:page-load'));
    await vi.waitFor(() => expect(initPreviewer).toHaveBeenCalledOnce());
    expect(load).toHaveBeenCalledTimes(1);
    expect(initPreviewer.mock.calls[0]![0].root).toBe(wc.element);
    wc.container.style.display = 'none';
    react.container.style.display = '';
    await vi.waitFor(() => expect(initPreviewer).toHaveBeenCalledTimes(2));
    expect(initPreviewer.mock.calls[1]![0].root).toBe(react.element);
    react.container.style.display = 'none';
    wc.container.style.display = '';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(load).toHaveBeenCalledTimes(2);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('rechecks visibility after import and reads the current preference on subsequent activation', async () => {
    const { container, element } = panel('wc', true);
    const seen: Array<string | null> = [];
    const initPreviewer = vi.fn(() => {
      seen.push(localStorage.getItem('preferred-prototypes-adapter'));
      element.dataset.inited = '1';
    });
    let resolve!: (client: { initPreviewer: typeof initPreviewer }) => void;
    const imported = new Promise<{ initPreviewer: typeof initPreviewer }>((done) => {
      resolve = done;
    });
    const load = vi.fn(() => imported);
    dispose = initPreviewerBootstrap(document, load);
    document.dispatchEvent(new Event('astro:page-load'));
    expect(load).toHaveBeenCalledTimes(1);
    container.style.display = 'none';
    localStorage.setItem('preferred-prototypes-adapter', 'vue2');
    resolve({ initPreviewer });
    await vi.waitFor(() => expect(element.dataset.mounting).toBeUndefined());
    expect(initPreviewer).not.toHaveBeenCalled();
    container.style.display = '';
    await vi.waitFor(() => expect(seen).toEqual(['vue2']));
  });

  it('keeps lazy intersection gating when a hidden panel becomes visible', async () => {
    const { container } = panel('react', false, true);
    const initPreviewer = vi.fn();
    const load = vi.fn(async () => ({ initPreviewer }));
    dispose = initPreviewerBootstrap(document, load);
    document.dispatchEvent(new Event('astro:page-load'));
    callbacks[0]!([{ isIntersecting: true }]);
    await flush();
    expect(load).not.toHaveBeenCalled();
    callbacks[0]!([{ isIntersecting: false }]);
    container.style.display = '';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(load).not.toHaveBeenCalled();
    callbacks[0]!([{ isIntersecting: true }]);
    await flush();
    expect(initPreviewer).toHaveBeenCalledTimes(1);
  });

  it.each(['remove', 'swap', 'dispose'] as const)(
    'cancels a deferred panel on %s',
    async (action) => {
      const { container } = panel('react', false);
      const initPreviewer = vi.fn();
      const load = vi.fn(async () => ({ initPreviewer }));
      dispose = initPreviewerBootstrap(document, load);
      document.dispatchEvent(new Event('astro:page-load'));
      if (action === 'remove') container.remove();
      if (action === 'swap') document.dispatchEvent(new Event('astro:before-swap'));
      if (action === 'dispose') dispose();
      container.style.display = '';
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(load).not.toHaveBeenCalled();
    }
  );

  it.each(['remove', 'dispose'] as const)(
    'cancels an in-flight visible-panel import on %s',
    async (action) => {
      const { container } = panel('react', true);
      const initPreviewer = vi.fn();
      let resolve!: (client: { initPreviewer: typeof initPreviewer }) => void;
      dispose = initPreviewerBootstrap(
        document,
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
      document.dispatchEvent(new Event('astro:page-load'));
      if (action === 'remove') container.remove();
      else dispose();
      resolve({ initPreviewer });
      await flush();
      expect(initPreviewer).not.toHaveBeenCalled();
    }
  );

  it.each(['remove', 'swap'] as const)(
    'revokes a queued eager fallback task on %s and mounts replacement roots',
    async (action) => {
      vi.stubGlobal('scheduler', undefined);
      vi.useFakeTimers();
      const element = root();
      delete element.dataset.lazy;
      const initPreviewer = vi.fn(({ root: mounted }: { root: HTMLElement }) => {
        mounted.dataset.inited = '1';
      });
      dispose = initPreviewerBootstrap(document, async () => ({ initPreviewer }));
      document.dispatchEvent(new Event('astro:page-load'));
      await flush();
      expect(element.dataset.mounting).toBe('1');
      expect(initPreviewer).not.toHaveBeenCalled();

      if (action === 'swap') {
        document.dispatchEvent(new Event('astro:before-swap'));
        expect(element.isConnected).toBe(true);
        await vi.runOnlyPendingTimersAsync();
        expect(initPreviewer).not.toHaveBeenCalled();
      }
      element.remove();
      const replacement = root();
      delete replacement.dataset.lazy;
      document.dispatchEvent(new Event('astro:page-load'));
      document.dispatchEvent(new Event('astro:page-load'));
      await flush();
      await vi.runOnlyPendingTimersAsync();
      expect(replacement.dataset.inited).toBe('1');
      expect(element.dataset.mounting).toBeUndefined();
      expect(initPreviewer).toHaveBeenCalledTimes(1);
      expect(initPreviewer).toHaveBeenCalledWith(
        expect.objectContaining({ root: replacement })
      );
    }
  );

  it('still mounts ordinary eager previews without panels', async () => {
    root().dataset.lazy = 'false';
    const initPreviewer = vi.fn();
    dispose = initPreviewerBootstrap(document, async () => ({ initPreviewer }));
    document.dispatchEvent(new Event('astro:page-load'));
    await vi.waitFor(() => expect(initPreviewer).toHaveBeenCalledTimes(1));
  });
});
