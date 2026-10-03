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
