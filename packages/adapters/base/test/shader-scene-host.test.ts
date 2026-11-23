import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NativeShaderSource, WebShaderPublication } from '../src/material/shader-webgl2-host';
import type {
  WebShaderCanvasSceneLease,
  WebShaderScenePublication,
} from '../src/material/shader-scene-host';

const boundary = vi.hoisted(() => ({
  sessions: [] as {
    sources: NativeShaderSource[];
    pending: { current(): boolean; frame: WebShaderPublication }[];
    releases: number[];
    alive: boolean;
  }[],
}));
// This owning-layer test observes the direct GPU boundary. Real WebGL/readback
// and the physical decode guard remain in the independent browser suite.
vi.mock('../src/material/shader-webgl2-host', () => ({
  validateWebShaderPublication(frame: WebShaderPublication) {
    if (
      !Number.isSafeInteger(frame.view) ||
      frame.view < 0 ||
      !Number.isSafeInteger(frame.revision) ||
      frame.revision < 0
    )
      throw new Error('shader-invalid-frame');
  },
  createWebShaderPresenter(options: { root(): HTMLElement | null; prepare(): void }) {
    const session = {
      sources: [] as NativeShaderSource[],
      pending: [] as { current(): boolean; frame: WebShaderPublication }[],
      releases: [] as number[],
      alive: true,
    };
    boundary.sessions.push(session);
    let serial = 0;
    return {
      commit(
        frame: WebShaderPublication,
        program: Function | null,
        prepare = options.prepare,
        valid = () => true
      ) {
        const turn = ++serial;
        prepare();
        if (!session.alive) return;
        const root = options.root();
        if (root) root.style.backgroundImage = 'none';
        if (!program) return;
        if (!valid()) return;
        program({
          upload(source: NativeShaderSource) {
            session.sources.push(source);
            return source;
          },
          copy(source: object) {
            return source;
          },
        });
        session.pending.push({ frame, current: () => session.alive && turn === serial && valid() });
      },
      release(view: number) {
        serial++;
        session.releases.push(view);
      },
      dispose() {
        serial++;
        session.alive = false;
      },
      diagnostics: () => [],
    };
  },
}));
import {
  createWebShaderHost,
  createWebShaderScenePresenter,
} from '../src/material/shader-scene-host';

type Frame = NonNullable<ReturnType<WebShaderCanvasSceneLease['current']>>;
const publication = (revision = 1, view = 1): WebShaderScenePublication => ({
  view,
  revision,
  key: 'copy-scene',
  fallback: [0.1, 0.2, 0.3, 1],
  slot: 'scene',
  resources: 2,
});
const program = (
  device: { upload(source: NativeShaderSource): object; copy(source: object): object },
  source: NativeShaderSource
) => device.copy(device.upload(source));
function fixture() {
  const scope = document.createElement('section'),
    canvas = document.createElement('canvas'),
    root = document.createElement('div');
  scope.append(canvas, root);
  document.body.append(scope);
  canvas.width = canvas.height = 1;
  let frame: Frame | null = Object.freeze({
    revision: 1,
    width: 1,
    height: 1,
    pixels: new Uint8Array([128, 64, 255, 255]),
    canvas,
    scope,
  });
  const callbacks: (() => void)[] = [],
    listeners = new Set<() => void>();
  const dispose = vi.fn(),
    off = vi.fn();
  const lease = {
    current: vi.fn(() => frame),
    subscribe: vi.fn((listener: () => void) => {
      callbacks.push(listener);
      listeners.add(listener);
      return () => {
        off();
        listeners.delete(listener);
      };
    }),
    dispose,
  };
  const presenter = createWebShaderScenePresenter({
    root: () => root,
    prepare() {},
    host: { ownedScenes: { scene: lease } },
  });
  const physical = boundary.sessions.at(-1)!;
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  return {
    scope,
    canvas,
    root,
    lease,
    presenter,
    physical,
    callbacks,
    off,
    dispose,
    notify,
    get frame() {
      return frame;
    },
    replace(next: Frame | null, announce = true) {
      frame = next;
      if (announce) notify();
    },
  };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  boundary.sessions.length = 0;
});

describe('borrowed scene source at the physical presenter boundary', () => {
  it('does no source/root work until the scene is selected', () => {
    const root = vi.fn(() => {
      throw new Error('unused root');
    });
    const current = vi.fn(() => {
      throw new Error('unused source');
    });
    const subscribe = vi.fn(() => {
      throw new Error('unused subscription');
    });
    const configured = createWebShaderHost({ ownedScenes: { scene: { current, subscribe } } });
    const presenter = configured.createScenePresenter({ root, prepare() {} });
    presenter.release(9);
    presenter.dispose();
    presenter.dispose();
    expect(root).not.toHaveBeenCalled();
    expect(current).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });
  it('copies opaque sRGB into independently owned linear RGBA8 before the pass boundary', () => {
    const f = fixture();
    f.presenter.commit(publication(), program);
    expect(f.physical.sources).toHaveLength(1);
    // Independent byte references: sRGB 128→linear55, 64→13, 255→255.
    expect(f.physical.sources[0].pixels).toEqual([55, 13, 255, 255]);
    f.frame!.pixels[0] = 0;
    expect(f.physical.sources[0].pixels[0]).toBe(55);
    expect(Object.isFrozen(f.physical.sources[0].pixels)).toBe(true);
    f.presenter.dispose();
    expect(f.off).toHaveBeenCalledOnce();
    expect(f.dispose).not.toHaveBeenCalled();
  });
  it('accepts a physical paint surface in an owned ShadowRoot', () => {
    const f = fixture(),
      element = document.createElement('div');
    f.scope.append(element);
    element.attachShadow({ mode: 'open' }).append(f.root);
    f.presenter.commit(publication(), program);
    expect(f.physical.sources).toHaveLength(1);
    f.presenter.dispose();
  });
  it.each([
    'foreign scope',
    'foreign Document',
    'source inside output',
    'detached canvas',
    'canvas extent changed',
  ])('refuses %s before any upload', (kind) => {
    const f = fixture();
    if (kind === 'foreign scope') document.body.append(f.root);
    if (kind === 'foreign Document')
      document.implementation.createHTMLDocument().body.append(f.root);
    if (kind === 'source inside output') {
      f.root.append(f.canvas);
    }
    if (kind === 'detached canvas') f.canvas.remove();
    if (kind === 'canvas extent changed') f.canvas.width = 2;
    f.presenter.commit(publication(), program);
    expect(f.physical.sources).toHaveLength(0);
    expect(f.presenter.diagnostics()).toContain('shader-scene-scope-unavailable');
    f.presenter.dispose();
  });
  it.each(['transparent', 'extent', 'texels', 'resource bytes'])(
    'refuses %s without allocating a GPU input',
    (kind) => {
      const f = fixture(),
        first = f.frame!;
      if (kind === 'transparent') first.pixels[3] = 254;
      else {
        const width = kind === 'extent' ? 1025 : kind === 'texels' ? 513 : 512;
        const height = kind === 'extent' ? 1 : 512;
        f.canvas.width = width;
        f.canvas.height = height;
        f.replace({ ...first, width, height }, false);
      }
      f.presenter.commit(
        { ...publication(), resources: kind === 'resource bytes' ? 17 : 2 },
        program
      );
      expect(f.physical.sources).toHaveLength(0);
      expect(f.presenter.diagnostics()).toContain(
        kind === 'transparent' ? 'shader-scene-nonopaque' : 'shader-scene-resource-budget'
      );
      f.presenter.dispose();
    }
  );
  it('retires held work on revoke, then accepts a strictly newer source frame', () => {
    const f = fixture(),
      first = f.frame!;
    f.presenter.commit(publication(), program);
    const held = f.physical.pending[0];
    expect(held.current()).toBe(true);
    f.replace(null);
    expect(held.current()).toBe(false);
    expect(f.root.style.backgroundImage).toBe('none');
    f.replace({ ...first, revision: 2, pixels: new Uint8Array([0, 255, 0, 255]) });
    expect(f.physical.sources.at(-1)?.pixels).toEqual([0, 255, 0, 255]);
    expect(f.physical.pending.at(-1)?.current()).toBe(true);
    expect(held.current()).toBe(false);
    f.presenter.dispose();
  });
  it('detects an unannounced replacement when held work tries to publish', () => {
    const f = fixture();
    f.presenter.commit(publication(), program);
    const held = f.physical.pending[0];
    f.replace({ ...f.frame!, revision: 2 }, false);
    expect(held.current()).toBe(false);
    f.presenter.dispose();
  });
  it('refuses source revision regression across a semantic update and remount', () => {
    const f = fixture(),
      first = f.frame!;
    f.presenter.commit(publication(), program);
    f.replace({ ...first, revision: 3 });
    f.replace(first, false);
    f.presenter.commit(publication(2), program);
    expect(f.presenter.diagnostics()).toContain('shader-scene-stale-revision');
    const count = f.physical.sources.length;
    f.presenter.release(1);
    f.presenter.commit(publication(1, 2), program);
    expect(f.physical.sources).toHaveLength(count);
    f.presenter.dispose();
  });
  it('retires scope moves even when no source notification was sent', async () => {
    const f = fixture();
    f.presenter.commit(publication(), program);
    const held = f.physical.pending[0];
    document.body.append(f.root);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(held.current()).toBe(false);
    expect(f.presenter.diagnostics()).toContain('shader-scene-scope-unavailable');
    const before = f.physical.sources.length;
    f.scope.append(f.root);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(f.physical.sources).toHaveLength(before + 1);
    expect(f.physical.pending.at(-1)?.current()).toBe(true);
    f.presenter.dispose();
  });
  it('retires a published surface moved between ShadowRoots without a Document mutation', async () => {
    const f = fixture(),
      first = document.createElement('div'),
      other = document.createElement('div');
    f.scope.append(first);
    document.body.append(other);
    first.attachShadow({ mode: 'open' }).append(f.root);
    const foreign = other.attachShadow({ mode: 'open' });
    f.presenter.commit(publication(), program);
    expect(f.physical.pending.at(-1)?.current()).toBe(true);
    f.root.style.backgroundImage = 'url("published.png")';
    foreign.append(f.root);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(f.root.style.backgroundImage).toBe('none');
    expect(f.presenter.diagnostics()).toContain('shader-scene-scope-unavailable');
    f.presenter.dispose();
  });
  it('ignores old notifications and releases only its subscription after remount', () => {
    const f = fixture();
    f.presenter.commit(publication(), program);
    const old = f.callbacks[0];
    f.presenter.release(1);
    f.presenter.commit(publication(1, 2), program);
    const reads = f.lease.current.mock.calls.length;
    old();
    f.presenter.release(1);
    expect(f.lease.current).toHaveBeenCalledTimes(reads);
    expect(f.physical.pending.at(-1)?.current()).toBe(true);
    f.presenter.dispose();
    expect(f.off).toHaveBeenCalledTimes(2);
    expect(f.dispose).not.toHaveBeenCalled();
  });
  it('retains fallback on current failure and can recover from a later valid notification', () => {
    const f = fixture();
    f.lease.current.mockImplementationOnce(() => {
      throw new Error('read');
    });
    f.presenter.commit(publication(), program);
    expect(f.physical.sources).toHaveLength(0);
    expect(f.root.style.backgroundImage).toBe('none');
    expect(f.presenter.diagnostics()).toContain('shader-scene-current-failed');
    f.notify();
    expect(f.physical.sources).toHaveLength(1);
    f.presenter.dispose();
  });
  it('handles subscribe failure and makes its captured late callback inert', () => {
    const f = fixture();
    let late = () => {};
    f.lease.subscribe.mockImplementationOnce((callback) => {
      late = callback;
      throw new Error('subscribe');
    });
    f.presenter.commit(publication(), program);
    late();
    expect(f.lease.current).not.toHaveBeenCalled();
    expect(f.physical.sources).toHaveLength(0);
    expect(f.presenter.diagnostics()).toContain('shader-scene-subscribe-failed');
    f.presenter.dispose();
    expect(f.dispose).not.toHaveBeenCalled();
  });
  it('releases an acquisition returned after synchronous subscribe disposal', () => {
    const f = fixture(),
      cleanup = vi.fn();
    f.lease.subscribe.mockImplementationOnce((callback) => {
      callback();
      f.presenter.dispose();
      return cleanup;
    });
    f.presenter.commit(publication(), program);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(f.lease.current).not.toHaveBeenCalled();
    expect(f.dispose).not.toHaveBeenCalled();
  });
  it('coalesces synchronous subscribe invalidation without reading before acquisition completes', () => {
    const f = fixture(),
      original = f.lease.subscribe.getMockImplementation()!;
    f.lease.subscribe.mockImplementationOnce((callback) => {
      callback();
      expect(f.lease.current).not.toHaveBeenCalled();
      return original(callback);
    });
    f.presenter.commit(publication(), program);
    expect(f.physical.sources).toHaveLength(1);
    f.presenter.dispose();
  });
  it('does not let a reentrant current result overwrite the replacement owner', () => {
    const f = fixture(),
      first = f.frame!;
    f.lease.current.mockImplementationOnce(() => {
      f.presenter.commit(publication(1, 2), program);
      return first;
    });
    f.presenter.commit(publication(), program);
    expect(f.physical.sources).toHaveLength(1);
    expect(f.physical.pending.at(-1)?.frame.view).toBe(2);
    f.presenter.dispose();
    expect(f.off).toHaveBeenCalledTimes(2);
  });
  it('keeps a reentrant replacement current even if old subscription cleanup throws', () => {
    const f = fixture();
    let once = true;
    f.lease.subscribe.mockImplementationOnce((callback) => {
      f.callbacks.push(callback);
      return () => {
        if (once) {
          once = false;
          f.presenter.commit(publication(1, 3), program);
        }
        throw new Error('cleanup');
      };
    });
    f.presenter.commit(publication(), program);
    f.presenter.commit(publication(1, 2), program);
    expect(f.physical.pending.at(-1)?.frame.view).toBe(3);
    expect(f.physical.pending.at(-1)?.current()).toBe(true);
    expect(f.presenter.diagnostics()).toContain('shader-scene-cleanup-failed');
    f.presenter.dispose();
  });
  it('bounds a source that synchronously invalidates on every read', () => {
    const f = fixture(),
      first = f.frame!;
    f.lease.current.mockImplementation(() => {
      f.notify();
      return first;
    });
    f.presenter.commit(publication(), program);
    expect(f.lease.current.mock.calls.length).toBeLessThanOrEqual(32);
    expect(f.presenter.diagnostics()).toContain('shader-scene-reentrant-source');
    expect(f.off).toHaveBeenCalledOnce();
    expect(f.physical.pending.every((item) => !item.current())).toBe(true);
    f.presenter.dispose();
    expect(f.off).toHaveBeenCalledOnce();
  });
});
