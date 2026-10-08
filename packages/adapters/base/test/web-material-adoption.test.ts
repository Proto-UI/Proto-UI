import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import type { CanvasBackdropFrame, CanvasBackdropLease } from '../src/material/source';
import { createWebMaterialSink } from '../src/material/sink';
import { createWebMaterialPreferences } from '../src/material/preferences';
import { createWebPointerContactWriter } from '../src/events/pointer-contact';
import { inspectWebOpticalResources } from '../src/material/program-pool';

const gpu = vi.hoisted(() => ({
  create: vi.fn((_canvas: HTMLCanvasElement) => ({
    render: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
  })),
}));
const images = vi.hoisted(() => ({
  prepare: vi.fn((_doc: Document, _image: string, ready: () => void, _failed: () => void) => {
    ready();
    return vi.fn();
  }),
}));
vi.mock('../src/material/contact-carrier', () => ({
  inspectContactCarrier: () => null,
  contactCarrierBounds: (element: Element) => element.getBoundingClientRect(),
  createContactCarrier: () => ({ valid: () => true, release() {} }),
}));
vi.mock('../src/material/program', () => ({ createWebOpticalProgram: gpu.create }));
vi.mock('../src/material/image-prepare', () => ({
  prepareOpticalImage: images.prepare,
  inspectOpticalImageResources: () => ({}),
}));

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  gpu.create.mockReset();
  images.prepare.mockReset();
});
const deliverMutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function environment(win: Window) {
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(win, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(win, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  let reduceTransparency = false;
  const listeners = new Set<() => void>();
  vi.spyOn(win, 'matchMedia').mockImplementation(
    (query) =>
      ({
        get matches() {
          if (query.includes('prefers-reduced-transparency'))
            return query.includes('no-preference') !== reduceTransparency;
          return query.includes('no-preference') || query === '(forced-colors: none)';
        },
        addEventListener(_type: string, fn: () => void) {
          listeners.add(fn);
        },
        removeEventListener(_type: string, fn: () => void) {
          listeners.delete(fn);
        },
      }) as unknown as MediaQueryList
  );
  return {
    frames,
    listeners,
    flush() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((fn) => fn(1));
    },
    transparency(value: boolean) {
      reduceTransparency = value;
      [...listeners].forEach((fn) => fn());
    },
  };
}

function fixture(preferences?: 'builtin' | 'custom') {
  const old = environment(window);
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const destination = iframe.contentWindow!;
  const next = environment(destination);
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  Object.defineProperty(destination, 'devicePixelRatio', { configurable: true, value: 2 });
  const scope = document.createElement('div');
  const canvas = document.createElement('canvas');
  const host = document.createElement('button');
  scope.append(canvas, host);
  document.body.append(scope);
  host.style.color = 'rgb(23, 23, 23)';
  host.style.borderRadius = '12px';
  let width = 100;
  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => new DOMRect(40, 30, width, 40));
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 240));
  let source: CanvasBackdropFrame;
  let paletteRevision = 1;
  function sourceFrame() {
    const dpr = host.ownerDocument.defaultView!.devicePixelRatio;
    canvas.width = 400 * dpr;
    canvas.height = 240 * dpr;
    source = {
      revision: 1,
      canvas,
      scope,
      width: canvas.width,
      height: canvas.height,
      pixels: new Uint8Array(canvas.width * canvas.height * 4).fill(255),
    };
  }
  sourceFrame();
  gpu.create.mockImplementation(() => ({
    render: vi.fn(() => 'data:image/png;base64,AA=='),
    clear: vi.fn(),
    dispose: vi.fn(),
  }));
  images.prepare.mockImplementation((_doc, _image, ready) => {
    ready();
    return vi.fn();
  });
  const sourceListeners = new Set<() => void>();
  const customPreferenceListeners = new Set<() => void>();
  let onSubscribe = () => {};
  let onUnsubscribe = () => {};
  let tokens: string[] = [];
  const sink = createWebMaterialSink(
    host,
    {
      queueStyle(style) {
        tokens = style.tokens;
      },
      requestFlush() {
        host.setAttribute('data-pui-style', tokens.join(' '));
      },
    },
    {
      preferences:
        preferences === 'builtin'
          ? createWebMaterialPreferences(window)
          : preferences === 'custom'
            ? {
                current: () => ({
                  reducedMotion: 'no-preference',
                  reducedTransparency: 'reduce',
                  contrast: 'no-preference',
                  forcedColors: 'none',
                }),
                subscribe(fn) {
                  customPreferenceListeners.add(fn);
                  return () => {
                    customPreferenceListeners.delete(fn);
                  };
                },
              }
            : undefined,
      source: {
        current: () => source,
        subscribe(fn) {
          sourceListeners.add(fn);
          const subscribed = onSubscribe;
          onSubscribe = () => {};
          subscribed();
          return () => {
            sourceListeners.delete(fn);
            const unsubscribed = onUnsubscribe;
            onUnsubscribe = () => {};
            unsubscribed();
          };
        },
      } as CanvasBackdropLease,
      palette: {
        current: () => ({
          revision: paletteRevision,
          colors: { background: '#fff', foreground: '#171717' },
        }),
        subscribe: () => () => {},
      },
    }
  );
  cleanup.push(() => sink.release(1));
  const frame = (revision: number): VisualFeedbackFrame => ({
    view: 1,
    revision,
    style: { kind: 'tw', tokens: ['bg-background', 'text-foreground', 'rounded-lg'] },
    material: {
      slot: {
        version: 2,
        shape: { kind: 'rounded-rect', geometry: 'style' },
        source: { kind: 'in-app-backdrop' },
        fallback: { fill: 'style', foreground: 'style' },
      },
      candidates: [{ intent: 'liquid-glass' }],
    },
  });
  return {
    host,
    scope,
    sink,
    frame,
    old,
    next,
    destination,
    sourceListeners,
    customPreferenceListeners,
    source: () => source,
    setSource(value: CanvasBackdropFrame) {
      source = value;
    },
    paletteRevision(value: number) {
      paletteRevision = value;
    },
    onSubscribe(fn: () => void) {
      onSubscribe = fn;
    },
    onUnsubscribe(fn: () => void) {
      onUnsubscribe = fn;
    },
    width(value: number) {
      width = value;
      host.className = `width-${value}`;
    },
    adopt(doc = destination.document) {
      // Happy DOM adopts only the supplied node, not its descendants. Use
      // real adoptNode for each node rather than mocking ownerDocument.
      doc.body.append(doc.adoptNode(scope));
      scope.append(doc.adoptNode(canvas), doc.adoptNode(host));
      expect(host.ownerDocument).toBe(doc);
      expect(canvas.ownerDocument).toBe(doc);
      sourceFrame();
    },
    invalidate() {
      [...sourceListeners].forEach((fn) => fn());
    },
  };
}

describe('material resources follow actual owner-document adoption (mock GPU, not native paint)', () => {
  it('rebinds on real removal observation and follows only destination geometry/preferences/DPR', async () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    const initial = gpu.create.mock.results[0].value;
    await deliverMutations();
    f.old.flush();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    const oldStyle = vi.spyOn(window, 'getComputedStyle');
    oldStyle.mockClear();
    f.adopt();
    await deliverMutations();
    f.old.flush();
    expect(gpu.create).toHaveBeenCalledTimes(2);
    expect(gpu.create.mock.calls[1][0].ownerDocument).toBe(f.destination.document);
    expect(initial.dispose).toHaveBeenCalledOnce();
    expect(inspectWebOpticalResources(document)).toMatchObject({ contexts: 0, consumers: 0 });
    expect(inspectWebOpticalResources(f.destination.document)).toMatchObject({
      contexts: 1,
      consumers: 1,
    });
    expect(f.old.listeners.size).toBe(0);
    expect(f.next.listeners.size).toBe(1);
    expect(oldStyle.mock.calls.some(([element]) => element === f.host)).toBe(false);
    const current = gpu.create.mock.results[1].value;
    expect(current.render.mock.lastCall[0].geometry.dpr).toBe(2);
    expect(images.prepare.mock.lastCall?.[0]).toBe(f.destination.document);
    expect(f.host.dataset.materialQuality).toBe('self-optical');

    await deliverMutations();
    f.next.flush();
    const before = current.render.mock.calls.length;
    const currentStyle = f.host.getAttribute('style');
    const currentReceipt = { ...f.host.dataset };
    gpu.create.mock.calls[0][0].dispatchEvent(new Event('webglcontextlost'));
    document.body.className = 'old-document-change';
    window.dispatchEvent(new Event('resize'));
    f.old.transparency(true);
    await deliverMutations();
    f.old.flush();
    expect(current.render).toHaveBeenCalledTimes(before);
    expect(f.host.getAttribute('style')).toBe(currentStyle);
    expect({ ...f.host.dataset }).toEqual(currentReceipt);
    f.width(120);
    await deliverMutations();
    f.next.flush();
    expect(current.render.mock.lastCall[0].geometry.width).toBe(120);
    f.next.transparency(true);
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    f.next.transparency(false);
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    f.sink.release(1);
    expect(f.next.listeners.size).toBe(0);
    expect(inspectWebOpticalResources(f.destination.document).contexts).toBe(0);
  });

  it('honors destination safety before any old-window animation frame can run', async () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    await deliverMutations();
    f.old.flush();
    f.adopt();
    await deliverMutations();
    // Adoption is a lifetime boundary, not old-window geometry work. Only
    // the destination gets rendering opportunities from this point onward.
    f.next.transparency(true);
    f.destination.dispatchEvent(new Event('resize'));
    f.width(120);
    await deliverMutations();
    f.next.flush();
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    expect(inspectWebOpticalResources(document).consumers).toBe(0);
    expect(f.old.listeners.size).toBe(0);
    expect(f.old.frames.size).toBe(0);
    expect(f.next.listeners.size).toBe(1);
  });

  it('rebinds before an old image completion can publish in the destination', () => {
    const f = fixture();
    const pending: { doc: Document; ready(): void; cancel: ReturnType<typeof vi.fn> }[] = [];
    images.prepare.mockImplementation((doc, _image, ready) => {
      const cancel = vi.fn();
      pending.push({ doc, ready, cancel });
      return cancel;
    });
    f.sink.commit(f.frame(1));
    f.adopt();
    pending[0].ready();
    expect(pending[0].cancel).toHaveBeenCalledOnce();
    expect(gpu.create).toHaveBeenCalledTimes(2);
    expect(inspectWebOpticalResources(document).contexts).toBe(0);
    expect(pending).toHaveLength(2);
    expect(pending[1].doc).toBe(f.destination.document);
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    pending[1].ready();
    const currentPaint = f.host.getAttribute('style');
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    pending[0].ready();
    expect(f.host.getAttribute('style')).toBe(currentPaint);
    expect(pending).toHaveLength(2);
  });

  it('retains frame freshness across explicit commits and terminal release', () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    f.adopt();
    f.sink.commit(f.frame(2));
    expect(gpu.create).toHaveBeenCalledTimes(2);
    expect(() => f.sink.commit(f.frame(2))).toThrow('Stale or cross-view material frame');
    expect(() => f.sink.commit({ ...f.frame(3), view: 2 })).toThrow(
      'Stale or cross-view material frame'
    );
    f.sink.release(2);
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    const staleNotify = [...f.sourceListeners];
    f.sink.release(1);
    staleNotify.forEach((fn) => fn());
    f.invalidate();
    f.sink.commit(f.frame(3));
    expect(gpu.create).toHaveBeenCalledTimes(2);
    expect(f.sourceListeners.size).toBe(0);
    expect(f.host.dataset.materialQuality).toBeUndefined();
  });
  it('uses destination safety preferences before publishing a rebound image', () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    f.next.transparency(true);
    f.adopt();
    f.invalidate();
    expect(gpu.create).toHaveBeenCalledTimes(2);
    const current = gpu.create.mock.results[1].value;
    expect(current.render).not.toHaveBeenCalled();
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    f.old.transparency(false);
    expect(current.render).not.toHaveBeenCalled();
    f.next.transparency(false);
    expect(current.render).toHaveBeenCalledOnce();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
  });

  it('preserves author paint takeover across physical document generations', () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    f.host.style.setProperty('background-size', '25% 25%', 'important');
    f.adopt();
    f.invalidate();
    expect(f.host.style.getPropertyValue('background-size')).toBe('25% 25%');
    expect(f.host.style.getPropertyPriority('background-size')).toBe('important');
    expect(f.host.dataset.materialQuality).toBe('unavailable');
    expect(f.host.dataset.materialReason).toBe('external-paint-conflict');
    f.host.style.removeProperty('background-size');
    f.invalidate();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
  });

  it('never reacquires resources if released before adoption', async () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    const oldNotification = [...f.sourceListeners];
    f.sink.release(1);
    f.adopt();
    oldNotification.forEach((fn) => fn());
    await deliverMutations();
    f.old.flush();
    f.next.flush();
    f.sink.commit(f.frame(2));
    expect(gpu.create).toHaveBeenCalledOnce();
    expect(f.sourceListeners.size).toBe(0);
    expect(f.next.listeners.size).toBe(0);
    expect(f.host.dataset.materialQuality).toBeUndefined();
  });
  it('does not revive a retired pointer session after document rebinding', () => {
    const f = fixture();
    const frame = f.frame(1);
    f.sink.commit({
      ...frame,
      material: {
        ...frame.material,
        candidates: [
          {
            intent: 'liquid-glass',
            deformation: { kind: 'press', phase: 'rest', contact: 'pointer' },
          },
        ],
      },
    });
    const writer = createWebPointerContactWriter(f.host);
    const sample = {
      active: true,
      session: writer.nextSession(),
      x: 0.6,
      y: 0.4,
      deltaX: 0.1,
      deltaY: 0.1,
      reason: 'down' as const,
    };
    writer.publish(sample);
    f.old.flush();
    expect(gpu.create.mock.results[0].value.render.mock.lastCall[0].contact.strength).toBe(1);
    f.adopt();
    f.invalidate();
    const current = gpu.create.mock.results[1].value;
    expect(current.render.mock.lastCall[0].contact.strength).toBe(0);
    writer.publish({ ...sample, reason: 'move', deltaX: 0.2 });
    f.next.flush();
    expect(current.render.mock.lastCall[0].contact.strength).toBe(0);
    writer.publish({ ...sample, session: writer.nextSession() });
    f.next.flush();
    expect(current.render.mock.lastCall[0].contact.strength).toBe(1);
  });

  it('queues reentrant newer intent until old resource cleanup finishes', () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    const newer = f.frame(3);
    f.onUnsubscribe(() =>
      f.sink.commit({ ...newer, material: { ...newer.material, candidates: [] } })
    );
    f.adopt();
    f.sink.commit(f.frame(2));
    expect(gpu.create).toHaveBeenCalledTimes(2);
    expect(gpu.create.mock.results[1].value.render).not.toHaveBeenCalled();
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    expect(() => f.sink.commit(f.frame(3))).toThrow('Stale or cross-view material frame');
  });

  it('retires a newly acquired binding if a provider releases the view during subscription', () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    f.onSubscribe(() => f.sink.release(1));
    f.adopt();
    f.invalidate();
    expect(gpu.create).toHaveBeenCalledTimes(2);
    expect(gpu.create.mock.results[1].value.dispose).toHaveBeenCalledOnce();
    expect(f.sourceListeners.size).toBe(0);
    expect(f.next.listeners.size).toBe(0);
    expect(inspectWebOpticalResources(document).contexts).toBe(0);
    expect(inspectWebOpticalResources(f.destination.document).contexts).toBe(0);
    expect(f.host.dataset.materialQuality).toBeUndefined();
  });
  it('does not reaccept an exact older source frame when its provider and nodes are adopted', () => {
    const f = fixture();
    Object.defineProperty(f.destination, 'devicePixelRatio', { configurable: true, value: 1 });
    const obsolete = f.source();
    f.setSource({ ...obsolete, revision: 9 });
    f.sink.commit(f.frame(1));
    expect(f.host.dataset.materialSourceRevision).toBe('9');
    f.adopt();
    f.setSource(obsolete);
    f.sink.commit(f.frame(2));
    expect(gpu.create.mock.results[1].value.render).not.toHaveBeenCalled();
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    f.setSource({ ...obsolete, revision: 10 });
    f.invalidate();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    expect(f.host.dataset.materialSourceRevision).toBe('10');
  });

  it('keeps the same palette provider revision high-water mark across adoption', () => {
    const f = fixture();
    f.paletteRevision(9);
    f.sink.commit(f.frame(1));
    f.adopt();
    f.paletteRevision(1);
    f.sink.commit(f.frame(2));
    expect(gpu.create.mock.results[1].value.render).not.toHaveBeenCalled();
    expect(f.host.dataset.materialQuality).toBe('unavailable');
    expect(f.host.dataset.materialReason).toBe('palette-revision-stale');
    f.paletteRevision(10);
    f.invalidate();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
  });
  it('rebinds an explicitly supplied built-in window preference provider', () => {
    // Matches the real preview-material-scene consumer's explicit provider.
    const f = fixture('builtin');
    f.sink.commit(f.frame(1));
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    f.next.transparency(true);
    f.adopt();
    f.sink.commit(f.frame(2));
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    expect(gpu.create.mock.results[1].value.render).not.toHaveBeenCalled();
    expect(f.old.listeners.size).toBe(0);
    expect(f.next.listeners.size).toBe(1);
    f.old.transparency(false);
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    f.next.transparency(false);
    expect(f.host.dataset.materialQuality).toBe('self-optical');
  });

  it('preserves an arbitrary custom preference provider across document rebinding', () => {
    const f = fixture('custom');
    f.sink.commit(f.frame(1));
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    f.adopt();
    f.sink.commit(f.frame(2));
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    expect(gpu.create.mock.results[1].value.render).not.toHaveBeenCalled();
    expect(f.customPreferenceListeners.size).toBe(1);
    expect(f.old.listeners.size).toBe(0);
    expect(f.next.listeners.size).toBe(0);
    f.sink.release(1);
    expect(f.customPreferenceListeners.size).toBe(0);
  });
});
