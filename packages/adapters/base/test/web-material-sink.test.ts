import { createWebPointerContactWriter } from '../src/events/pointer-contact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import { createWebMaterialSink } from '../src/material/sink';
import type { CanvasBackdropFrame, CanvasBackdropLease } from '../src/material/source';
const optical = vi.hoisted(() => ({
  render: vi.fn((_frame: unknown) => 'data:image/png;base64,AA=='),
  clear: vi.fn(),
}));
const decoding = vi.hoisted(() => ({
  prepare: vi.fn((_doc: Document, _source: string, ready: () => void, _failed: () => void) => {
    ready();
    return () => {};
  }),
}));
vi.mock('../src/material/image-prepare', () => ({
  prepareOpticalImage: decoding.prepare,
  inspectOpticalImageResources: () => ({}),
}));
vi.mock('../src/material/program', () => ({ createWebOpticalProgram: () => optical }));
vi.mock('../src/material/contact-carrier', () => ({
  inspectContactCarrier: () => null,
  contactCarrierBounds: (element: Element) => element.getBoundingClientRect(),
  createContactCarrier: () => ({ valid: () => true, release() {} }),
}));
const rect = (x: number, y: number, width: number, height: number) =>
  ({
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON() {},
  }) as DOMRect;
function fixture(delayed = false) {
  const scope = document.createElement('div'),
    canvas = document.createElement('canvas'),
    host = document.createElement('button');
  scope.append(canvas, host);
  document.body.append(scope);
  canvas.width = 400;
  canvas.height = 240;
  host.style.color = 'rgb(23, 23, 23)';
  host.style.borderRadius = '12px';
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 400, 240));
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(rect(40, 30, 100, 40));
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  let source: CanvasBackdropFrame | null = {
    revision: 1,
    width: 400,
    height: 240,
    canvas,
    scope,
    pixels: new Uint8Array(400 * 240 * 4).fill(255),
  };
  const sourceListeners = new Set<() => void>(),
    preferenceListeners = new Set<() => void>();
  let reducedMotion: 'no-preference' | 'reduce' = 'no-preference',
    reducedTransparency: 'no-preference' | 'reduce' = 'no-preference';
  let paletteThrows = false;
  let contrast: 'no-preference' | 'more' = 'no-preference';
  let tokens: string[] = [];
  const flush = () => host.setAttribute('data-pui-style', tokens.join(' '));
  const sink = createWebMaterialSink(
    host,
    {
      queueStyle(style) {
        tokens = style.tokens;
      },
      requestFlush() {
        if (!delayed) flush();
      },
    },
    {
      source: {
        current: () => source,
        subscribe(fn) {
          sourceListeners.add(fn);
          return () => {
            sourceListeners.delete(fn);
          };
        },
      } as CanvasBackdropLease,
      palette: {
        current: () => {
          if (paletteThrows) throw new Error('palette-failed');
          return { revision: 1, colors: { background: '#fff', foreground: '#171717' } };
        },
        subscribe: () => () => {},
      },
      preferences: {
        current: () => ({
          reducedMotion,
          reducedTransparency,
          contrast,
          forcedColors: 'none',
        }),
        subscribe(fn) {
          preferenceListeners.add(fn);
          return () => {
            preferenceListeners.delete(fn);
          };
        },
      },
    }
  );
  const frame = (
    revision: number,
    tokens = ['bg-background', 'text-foreground', 'rounded-lg']
  ): VisualFeedbackFrame => ({
    view: 1,
    revision,
    style: { kind: 'tw', tokens },
    material: {
      slot: {
        version: 2,
        shape: { kind: 'rounded-rect', geometry: 'style' },
        source: { kind: 'in-app-backdrop' },
        fallback: { fill: 'style', foreground: 'style' },
      },
      candidates: [{ intent: 'liquid-glass', deformation: { kind: 'press', phase: 'pressed' } }],
    },
  });
  return {
    host,
    sink,
    frame,
    flush,
    sourceListeners,
    preferenceListeners,
    failPalette() {
      paletteThrows = true;
    },
    silentTransparency() {
      reducedTransparency = 'reduce';
    },
    silentContrast() {
      contrast = 'more';
    },
    invalidate: () => {
      for (const fn of sourceListeners) fn();
    },
    source(value: boolean) {
      source = value
        ? {
            revision: 3,
            width: 400,
            height: 240,
            canvas,
            scope,
            pixels: new Uint8Array(400 * 240 * 4).fill(255),
          }
        : null;
      for (const fn of sourceListeners) fn();
    },
    motion(value: typeof reducedMotion) {
      reducedMotion = value;
      for (const fn of preferenceListeners) fn();
    },
    transparency(value: typeof reducedTransparency) {
      reducedTransparency = value;
      for (const fn of preferenceListeners) fn();
    },
  };
}
beforeEach(() => {
  optical.render.mockReset().mockReturnValue('data:image/png;base64,AA==');
  optical.clear.mockClear();
  decoding.prepare.mockReset().mockImplementation((_doc, _source, ready) => {
    ready();
    return () => {};
  });
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
describe('V2 physical-view material ownership (mock GPU, not optical evidence)', () => {
  it('publishes a self-optical receipt only after host paint and restores owned styles on release', () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    expect(optical.render).toHaveBeenCalledOnce();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    expect(f.host.style.backgroundImage).toContain('data:image/png');
    expect(f.host.children).toHaveLength(0);
    f.sink.release(1);
    expect(f.host.style.backgroundImage).toBe('');
    expect(f.sourceListeners.size).toBe(0);
    expect(f.preferenceListeners.size).toBe(0);
  });
  it('waits for exact asynchronous framework style delivery and discards a superseded frame', () => {
    const f = fixture(true);
    f.sink.commit(f.frame(1));
    expect(optical.render).not.toHaveBeenCalled();
    expect(f.host.dataset.materialReason).toBe('final-style-host-commit-pending');
    expect(f.host.style.backgroundColor).toBe('');
    f.sink.commit(f.frame(2, ['bg-background', 'text-foreground', 'rounded-full']));
    f.host.setAttribute('data-pui-style', 'text-foreground rounded-lg');
    f.invalidate();
    expect(optical.render).not.toHaveBeenCalled();
    f.flush();
    f.invalidate();
    expect(optical.render).toHaveBeenCalledOnce();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    f.sink.release(1);
  });
  it('actual delayed DOM token delivery schedules one shared geometry check and then goes idle', async () => {
    const f = fixture(true);
    f.sink.commit(f.frame(1));
    expect(optical.render).not.toHaveBeenCalled();
    f.flush();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const scheduled = vi.mocked(window.requestAnimationFrame);
    expect(scheduled).toHaveBeenCalledOnce();
    scheduled.mock.calls[0][0](performance.now());
    expect(optical.render).toHaveBeenCalledOnce();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(scheduled).toHaveBeenCalledOnce();
    f.sink.release(1);
  });
  it('keeps opaque paint until image decode and drops superseded, revoked and retired preparations', () => {
    const callbacks: Array<() => void> = [];
    decoding.prepare.mockImplementation((_doc, _source, ready) => {
      callbacks.push(ready);
      return () => {};
    });
    const f = fixture();
    f.sink.commit(f.frame(1));
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    expect(f.host.style.backgroundImage).toBe('none');
    f.sink.commit(f.frame(2));
    callbacks[0]();
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    callbacks[1]();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    f.sink.commit(f.frame(3));
    f.source(false);
    callbacks[2]();
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    f.source(true);
    f.sink.release(1);
    callbacks.at(-1)!();
    expect(f.host.style.backgroundImage).toBe('');
    expect(f.host.dataset.materialQuality).toBeUndefined();
  });
  it('never reuses the previous white fallback when the current palette getter fails', () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    f.failPalette();
    f.sink.commit(f.frame(2, ['bg-black', 'text-white', 'rounded-full']));
    expect(f.host.dataset.materialQuality).toBe('unavailable');
    expect(f.host.style.backgroundColor).toBe('');
    expect(f.host.style.backgroundImage).toBe('');
    expect(f.host.getAttribute('data-pui-style')).toBe('bg-black text-white rounded-full');
    f.sink.release(1);
  });
  it.each(['transparency', 'contrast', 'geometry', 'palette'] as const)(
    'revalidates %s at the asynchronous decode boundary without publishing an unsafe frame',
    (kind) => {
      let ready = () => {};
      decoding.prepare.mockImplementation((_doc, _source, callback) => {
        ready = callback;
        return () => {};
      });
      const f = fixture();
      f.sink.commit(f.frame(1));
      if (kind === 'transparency') f.silentTransparency();
      if (kind === 'contrast') f.silentContrast();
      if (kind === 'geometry')
        vi.mocked(f.host.getBoundingClientRect).mockReturnValue(rect(45, 30, 100, 40));
      if (kind === 'palette') f.failPalette();
      ready();
      expect(f.host.dataset.materialQuality).not.toBe('self-optical');
      expect(f.host.style.backgroundImage).not.toContain('data:image');
      f.sink.release(1);
    }
  );
  it('constrains reduced motion to static optics but transparency loss withdraws and recovers', () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    f.motion('reduce');
    expect(optical.render.mock.calls.at(-1)?.[0]).toMatchObject({ pressed: false });
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    f.transparency('reduce');
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    expect(f.host.style.backgroundImage).toBe('none');
    f.transparency('no-preference');
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    f.sink.release(1);
  });
  it('revokes source pixels and recovers without forging a new semantic frame', () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    f.source(false);
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    expect(f.host.style.backgroundImage).toBe('none');
    f.source(true);
    expect(f.host.dataset.materialSourceRevision).toBe('3');
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    f.sink.release(1);
  });
  it('does not resurrect a view released during GPU preparation, even if it throws', () => {
    const f = fixture();
    optical.render.mockImplementationOnce(() => {
      f.sink.release(1);
      throw new Error('late failure');
    });
    f.sink.commit(f.frame(1));
    expect(f.host.dataset.materialQuality).toBeUndefined();
    expect(f.host.style.backgroundImage).toBe('');
    expect(f.sourceListeners.size).toBe(0);
  });
  it('a source replacement during preparation cannot publish the obsolete optical result', () => {
    const f = fixture();
    optical.render.mockImplementationOnce(() => {
      f.source(false);
      return 'data:image/png;base64,AA==';
    });
    f.sink.commit(f.frame(1));
    expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
    expect(f.host.style.backgroundImage).toBe('none');
    f.sink.release(1);
  });
  it('shares one GPU context across surfaces and withdraws/rebuilds all leases after context loss', () => {
    const create = vi.spyOn(document, 'createElement');
    const a = fixture(),
      b = fixture();
    a.sink.commit(a.frame(1));
    b.sink.commit(b.frame(1));
    const canvases = create.mock.results
      .map((result) => result.value)
      .filter((node) => node instanceof HTMLCanvasElement) as HTMLCanvasElement[];
    expect(canvases).toHaveLength(3); // two visible sources, one shared optical target
    canvases[1].dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(a.host.dataset.materialQuality).toBe('opaque-fallback');
    expect(b.host.dataset.materialQuality).toBe('opaque-fallback');
    canvases[1].dispatchEvent(new Event('webglcontextrestored'));
    expect(a.host.dataset.materialQuality).toBe('self-optical');
    expect(b.host.dataset.materialQuality).toBe('self-optical');
    a.sink.release(1);
    b.invalidate();
    expect(b.host.dataset.materialQuality).toBe('self-optical');
    b.sink.release(1);
  });
  it('preserves unrelated inline updates and legal style when fallback cannot be owned', () => {
    const f = fixture();
    f.sink.commit(f.frame(1));
    f.host.style.backgroundImage = 'linear-gradient(red, blue)';
    f.sink.release(1);
    expect(f.host.style.backgroundImage).toBe('linear-gradient(red, blue)');
    const g = fixture();
    g.sink.commit(g.frame(1, ['bg-background/80', 'text-foreground']));
    expect(g.host.dataset.materialQuality).toBe('unavailable');
    expect(g.host.getAttribute('data-pui-style')).toContain('bg-background/80');
    g.sink.release(1);
  });
});

describe('continuous contact scheduler (mock GPU/decode, not optical evidence)', () => {
  function setup() {
    const f = fixture();
    let callbacks: FrameRequestCallback[] = [];
    vi.mocked(window.requestAnimationFrame).mockImplementation((fn) => {
      callbacks.push(fn);
      return callbacks.length;
    });
    const flushFrame = () => {
      const batch = callbacks;
      callbacks = [];
      batch.forEach((fn) => fn(performance.now()));
    };
    const baseFrame = f.frame(1);
    const frame: VisualFeedbackFrame = {
      ...baseFrame,
      material: {
        ...baseFrame.material,
        candidates: [
          {
            intent: 'liquid-glass',
            deformation: { kind: 'press', phase: 'pressed', contact: 'pointer' },
          },
        ],
      },
    };
    f.sink.commit(frame);
    const writer = createWebPointerContactWriter(f.host);
    const send = (x: number, reason: 'down' | 'move' | 'up' | 'cancel' = 'move', session = 1) =>
      writer.publish({
        active: reason === 'move' || reason === 'down',
        session,
        x,
        y: 0.4,
        deltaX: x - 0.5,
        deltaY: 0,
        reason,
      });
    return { ...f, frame, send, flushFrame };
  }
  it('coalesces many moves to the newest sample in one RAF', () => {
    const f = setup();
    f.send(0.5, 'down');
    f.flushFrame();
    optical.render.mockClear();
    for (let i = 0; i < 50; i++) f.send(0.5 + i / 100);
    expect(optical.render).not.toHaveBeenCalled();
    f.flushFrame();
    expect(optical.render).toHaveBeenCalledOnce();
    expect(optical.render.mock.calls[0][0]).toMatchObject({ contact: { x: 0.99 } });
    expect(f.host.dataset.materialProfile).toBe('liquidgl-v2-contact-canvas-1');
    f.sink.release(1);
  });
  it('keeps one decode in flight and atomically replaces the admitted safe image', () => {
    const f = setup();
    f.send(0.5, 'down');
    f.flushFrame();
    const safe = f.host.style.getPropertyValue('--pui-material-image');
    const callbacks: Array<() => void> = [];
    const cancels: Array<ReturnType<typeof vi.fn>> = [];
    decoding.prepare.mockImplementation((_doc, _source, ready) => {
      callbacks.push(ready);
      const cancel = vi.fn();
      cancels.push(cancel);
      return cancel;
    });
    optical.render.mockClear();
    f.send(0.7);
    f.flushFrame();
    expect(f.host.style.getPropertyValue('--pui-material-image')).toBe(safe);
    f.send(0.8);
    f.flushFrame();
    f.send(0.9);
    f.flushFrame();
    expect(callbacks).toHaveLength(1);
    expect(optical.render).toHaveBeenCalledOnce();
    callbacks[0]();
    f.flushFrame();
    expect(callbacks).toHaveLength(2);
    expect(optical.render.mock.calls[1][0]).toMatchObject({ contact: { x: 0.9 } });
    expect(cancels[0]).not.toHaveBeenCalled();
    callbacks[1]();
    expect(cancels[0]).toHaveBeenCalledOnce();
    f.sink.release(1);
  });
  it('revocation and a new session cannot revive a late decoded image', () => {
    const f = setup();
    f.send(0.5, 'down');
    f.flushFrame();
    const callbacks: Array<() => void> = [];
    decoding.prepare.mockImplementation((_doc, _source, ready) => {
      callbacks.push(ready);
      return () => {};
    });
    f.send(0.8);
    f.flushFrame();
    f.source(false);
    expect(f.host.style.backgroundImage).toBe('none');
    callbacks[0]();
    expect(f.host.style.backgroundImage).toBe('none');
    f.source(true);
    f.flushFrame();
    f.send(0.2, 'down', 2);
    f.flushFrame();
    const count = optical.render.mock.calls.length;
    callbacks[1]?.();
    expect(optical.render.mock.calls.length).toBe(count);
    f.sink.release(1);
  });
});
