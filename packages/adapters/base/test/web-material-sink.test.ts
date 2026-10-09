import { createWebPointerContactWriter } from '../src/events/pointer-contact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import { createWebMaterialSink } from '../src/material/sink';
import type { CanvasBackdropFrame, CanvasBackdropLease } from '../src/material/source';
const optical = vi.hoisted(() => ({
  render: vi.fn((_frame: unknown) => 'data:image/png;base64,AA=='),
  clear: vi.fn(),
}));
const carrierControl = vi.hoisted(() => ({
  create: null as
    | null
    | ((host: HTMLElement) => { valid(image: string): boolean; release(): void }),
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
vi.mock('../src/material/contact-carrier', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/material/contact-carrier')>()),
  inspectContactCarrier: () => null,
  contactCarrierBounds: (element: Element) => element.getBoundingClientRect(),
  createContactCarrier: (host: HTMLElement) =>
    carrierControl.create?.(host) ?? { valid: () => true, release() {} },
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
  let paletteRevision = 1;
  const paletteListeners = new Set<() => void>();
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
          return {
            revision: paletteRevision,
            colors: { background: '#fff', foreground: '#171717' },
          };
        },
        subscribe(fn) {
          paletteListeners.add(fn);
          return () => {
            paletteListeners.delete(fn);
          };
        },
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
    palette() {
      paletteRevision++;
      for (const fn of paletteListeners) fn();
    },
    rebindSource() {
      const nextCanvas = document.createElement('canvas');
      nextCanvas.width = canvas.width;
      nextCanvas.height = canvas.height;
      scope.prepend(nextCanvas);
      vi.spyOn(nextCanvas, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 400, 240));
      source = { ...source!, canvas: nextCanvas };
      for (const fn of sourceListeners) fn();
    },
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
    source(value: boolean, revision = 3) {
      source = value
        ? {
            revision,
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
  carrierControl.create = null;
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
  it.each(['::before', '::after'])(
    'withdraws an existing receipt on authored sibling %s and recovers after removal',
    (pseudo) => {
      const f = fixture(),
        sibling = document.createElement('div');
      f.host.parentElement!.append(sibling);
      vi.spyOn(sibling, 'getBoundingClientRect').mockReturnValue(rect(260, 30, 20, 20));
      let content = 'none';
      const nativeStyle = window.getComputedStyle.bind(window);
      vi.spyOn(window, 'getComputedStyle').mockImplementation((element, selected) =>
        element === sibling && selected === pseudo
          ? ({
              content,
              display: 'block',
              visibility: 'visible',
              opacity: '1',
              position: 'fixed',
              left: '40px',
              top: '30px',
              width: '100px',
              height: '40px',
              backgroundColor: 'rgb(255, 0, 0)',
            } as CSSStyleDeclaration)
          : nativeStyle(element, selected)
      );
      try {
        f.sink.commit(f.frame(1));
        expect(f.host.dataset.materialQuality).toBe('self-optical');
        expect(optical.render).toHaveBeenCalledOnce();
        content = '\"\"';
        // Explicit source invalidation, with computed CSS injected above. This
        // tests receipt withdrawal, not native paint or CSS mutation delivery.
        f.invalidate();
        expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
        expect(f.host.dataset.materialReason).toBe('source-authored-pseudo-unavailable');
        expect(f.host.style.backgroundImage).toBe('none');
        expect(optical.render).toHaveBeenCalledOnce();
        content = 'none';
        f.invalidate();
        expect(f.host.dataset.materialQuality).toBe('self-optical');
        expect(optical.render).toHaveBeenCalledTimes(2);
      } finally {
        f.sink.release(1);
      }
    }
  );
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
  it.each([
    ['background-size', '25% 25%'],
    ['background-repeat', 'repeat'],
    ['background-origin', 'content-box'],
    ['background-clip', 'content-box'],
  ])('revokes the non-contact receipt after author replaces %s', async (property, replacement) => {
    const f = fixture();
    try {
      f.sink.commit(f.frame(1));
      expect(f.host.dataset.materialQuality).toBe('self-optical');
      expect(optical.render.mock.calls[0][0]).not.toHaveProperty('contact', expect.anything());
      const image = f.host.style.backgroundImage;
      f.invalidate();
      expect(optical.render).toHaveBeenCalledOnce();
      f.host.style.setProperty(property, replacement, 'important');
      expect(f.host.style.backgroundImage).toBe(image);
      // Actual MutationObserver delivery; manually drain the scheduled RAF so the
      // mocked clock cannot turn an unobserved mutation into a false pass.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const callback = vi.mocked(window.requestAnimationFrame).mock.calls.at(-1)?.[0];
      expect(callback).toBeTypeOf('function');
      callback!(0);
      expect(f.host.dataset.materialQuality).not.toBe('self-optical');
      expect(f.host.dataset.materialReason).toBe('external-paint-conflict');
      expect(f.host.style.getPropertyValue(property)).toBe(replacement);
      expect(f.host.style.getPropertyPriority(property)).toBe('important');
      f.sink.release(1);
      expect(f.host.style.getPropertyValue(property)).toBe(replacement);
      expect(f.host.style.getPropertyPriority(property)).toBe('important');
    } finally {
      f.sink.release(1);
    }
  });
  it('revokes the non-contact receipt when an owned background priority changes alone', () => {
    const f = fixture();
    try {
      f.sink.commit(f.frame(1));
      const value = f.host.style.backgroundSize;
      f.host.style.setProperty('background-size', value, 'important');
      f.invalidate();
      expect(f.host.dataset.materialQuality).not.toBe('self-optical');
      expect(f.host.style.backgroundSize).toBe(value);
      expect(f.host.style.getPropertyPriority('background-size')).toBe('important');
      f.sink.release(1);
    } finally {
      f.sink.release(1);
    }
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
    const send = (
      x: number,
      reason: 'down' | 'move' | 'up' | 'cancel' | 'lostcapture' | 'blur' = 'move',
      session = 1
    ) =>
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
  it.each(['first down', 'repress during release'])(
    'retains admitted paint through %s while rejecting superseded session completions',
    (transition) => {
      let image = 0;
      optical.render.mockImplementation(() => `data:image/png;base64,${btoa(String(++image))}`);
      const releaseCarrier = vi.fn();
      carrierControl.create = () => ({ valid: () => true, release: releaseCarrier });
      const f = setup();
      try {
        if (transition === 'repress during release') {
          f.send(0.5, 'down');
          f.flushFrame();
          f.send(0.8);
          f.flushFrame();
          f.send(0.8, 'up');
          f.flushFrame();
          expect(f.host.dataset.materialContact).toBe('release');
        }
        const safe = f.host.style.getPropertyValue('--pui-material-image');
        const admittedFrame = f.host.dataset.materialFrame;
        const callbacks: Array<() => void> = [];
        const cancellations: Array<ReturnType<typeof vi.fn>> = [];
        decoding.prepare.mockImplementation((_doc, _source, ready) => {
          callbacks.push(ready);
          const cancel = vi.fn();
          cancellations.push(cancel);
          return cancel;
        });
        // A live source successor is pending before the pointer session changes.
        f.source(true, 2);
        expect(callbacks).toHaveLength(1);
        const releases = releaseCarrier.mock.calls.length;
        const nextSession = transition === 'first down' ? 1 : 2;
        f.send(0.2, 'down', nextSession);
        expect(cancellations[0]).toHaveBeenCalledOnce();
        expect(f.host.style.getPropertyValue('--pui-material-image')).toBe(safe);
        expect(f.host.style.backgroundColor).toBe('transparent');
        expect(releaseCarrier).toHaveBeenCalledTimes(releases);
        f.flushFrame();
        expect(callbacks).toHaveLength(2);
        expect(f.host.dataset.materialQuality).toBe('self-optical');
        expect(f.host.style.getPropertyValue('--pui-material-image')).toBe(safe);
        expect(f.host.style.backgroundColor).toBe('transparent');
        callbacks[0]();
        expect(f.host.dataset.materialFrame).toBe(admittedFrame);
        expect(f.host.style.getPropertyValue('--pui-material-image')).toBe(safe);
        callbacks[1]();
        expect(f.host.style.getPropertyValue('--pui-material-image')).not.toBe(safe);
        expect(f.host.dataset.materialContact).toBe('held');
        expect(f.host.dataset.materialContactSession).toBe(String(nextSession));
        expect(f.host.dataset.materialSourceRevision).toBe('2');
        expect(releaseCarrier).toHaveBeenCalledTimes(releases);
      } finally {
        f.sink.release(1);
      }
    }
  );
  function neutralFixture() {
    let image = 0;
    optical.render.mockImplementation(() => `data:image/png;base64,${btoa(String(++image))}`);
    const f = setup();
    const rest: VisualFeedbackFrame = {
      ...f.frame,
      revision: 2,
      material: {
        ...f.frame.material,
        candidates: [
          {
            intent: 'liquid-glass',
            deformation: {
              kind: 'press',
              phase: 'rest',
              contact: 'pointer',
            },
          },
        ],
      },
    };
    f.sink.commit(rest);
    const neutral = f.host.style.getPropertyValue('--pui-material-image');
    f.send(0.5, 'down');
    f.flushFrame();
    const held = f.host.style.getPropertyValue('--pui-material-image');
    expect(held).not.toBe(neutral);
    const callbacks: Array<() => void> = [];
    const retirements: ReturnType<typeof vi.fn>[] = [];
    decoding.prepare.mockImplementation((_doc, _source, ready) => {
      callbacks.push(ready);
      const retire = vi.fn();
      retirements.push(retire);
      return retire;
    });
    return { ...f, rest, neutral, held, callbacks, retirements };
  }
  it.each(['cancel', 'lostcapture', 'blur'] as const)(
    'atomically replaces %s held paint with admitted neutral while its successor decodes',
    (reason) => {
      const f = neutralFixture();
      try {
        f.source(true, 2); // Old held decode may settle even after cancellation.
        f.send(0.5, reason);
        expect(f.host.style.getPropertyValue('--pui-material-image')).toBe(f.neutral);
        expect(f.host.style.getPropertyValue('--pui-material-image')).not.toBe(f.held);
        expect(f.host.style.backgroundColor).toBe('transparent');
        expect(f.host.dataset.materialContact).toBe('rest');
        expect(f.host.dataset.materialContactSession).toBe('1');
        expect(f.host.dataset.materialSourceRevision).toBe('1');
        f.sink.commit({ ...f.rest, revision: 3 });
        f.flushFrame();
        expect(f.host.dataset.materialQuality).toBe('self-optical');
        f.callbacks[0](); // Rejected held completion cannot replace neutral.
        expect(f.host.style.getPropertyValue('--pui-material-image')).toBe(f.neutral);
        f.callbacks.at(-1)?.();
        expect(f.host.style.getPropertyValue('--pui-material-image')).not.toBe(f.neutral);
        expect(f.host.dataset.materialContact).toBe('rest');
        expect(f.host.dataset.materialSourceRevision).toBe('2');
      } finally {
        f.sink.release(1);
      }
    }
  );
  it.each([
    'source',
    'source owner',
    'palette',
    'geometry',
    'preference',
    'author',
    'material',
    'view',
  ])('does not bridge neutral after %s admission is revoked', (invalidation) => {
    const f = neutralFixture();
    try {
      if (invalidation === 'source') f.source(false);
      else if (invalidation === 'source owner') f.rebindSource();
      else if (invalidation === 'palette') f.palette();
      else if (invalidation === 'geometry') {
        vi.mocked(f.host.getBoundingClientRect).mockReturnValue(rect(45, 30, 100, 40));
        f.invalidate();
      } else if (invalidation === 'preference') f.silentTransparency();
      else if (invalidation === 'author')
        f.host.style.setProperty('background-image', 'none', 'important');
      else if (invalidation === 'material')
        f.sink.commit({ ...f.rest, revision: 3, material: { ...f.rest.material, candidates: [] } });
      else f.sink.release(1);
      f.send(0.5, 'cancel');
      expect(f.host.style.getPropertyValue('--pui-material-image')).toBe('');
      f.callbacks.forEach((done) => done());
      expect(f.host.style.getPropertyValue('--pui-material-image')).not.toBe(f.neutral);
      if (invalidation === 'author')
        expect(f.host.style.getPropertyPriority('background-image')).toBe('important');
    } finally {
      f.sink.release(1);
    }
  });
  it.each(['source', 'palette', 'geometry', 'preference', 'author'])(
    'withdraws an already restored neutral bridge on later %s revocation',
    (invalidation) => {
      const f = neutralFixture();
      try {
        f.send(0.5, 'cancel');
        expect(f.host.style.getPropertyValue('--pui-material-image')).toBe(f.neutral);
        if (invalidation === 'source') f.source(false);
        else if (invalidation === 'palette') f.palette();
        else if (invalidation === 'geometry') {
          vi.mocked(f.host.getBoundingClientRect).mockReturnValue(rect(45, 30, 100, 40));
          f.invalidate();
        } else if (invalidation === 'preference') f.transparency('reduce');
        else {
          f.host.style.setProperty('background-image', 'none', 'important');
          f.invalidate();
        }
        expect(f.host.style.getPropertyValue('--pui-material-image')).toBe('');
        f.callbacks.forEach((done) => done());
        expect(f.host.style.getPropertyValue('--pui-material-image')).not.toBe(f.neutral);
      } finally {
        f.sink.release(1);
      }
    }
  );
  it.each([
    [5, 7],
    [2.5, 3.25],
    [0, 8],
  ])(
    'rebuilds neutral carrier origin for current left/top borders %s/%s without changing outer bounds',
    (left, top) => {
      const f = neutralFixture();
      try {
        const outset = -parseFloat(f.host.style.getPropertyValue('--pui-material-left'));
        f.host.style.borderLeft = `${left}px solid red`;
        f.host.style.borderTop = `${top}px solid red`;
        f.invalidate();
        f.send(0.5, 'cancel');
        expect(f.host.style.getPropertyValue('--pui-material-image')).toBe(f.neutral);
        expect(parseFloat(f.host.style.getPropertyValue('--pui-material-left'))).toBe(
          -outset - left
        );
        expect(parseFloat(f.host.style.getPropertyValue('--pui-material-top'))).toBe(-outset - top);
        f.host.style.borderLeft = `${left + 1}px solid red`;
        f.host.style.borderTop = `${top + 2}px solid red`;
        f.callbacks.at(-1)?.();
        expect(parseFloat(f.host.style.getPropertyValue('--pui-material-left'))).toBe(
          -outset - left - 1
        );
        expect(parseFloat(f.host.style.getPropertyValue('--pui-material-top'))).toBe(
          -outset - top - 2
        );
      } finally {
        f.sink.release(1);
      }
    }
  );
  it('keeps cancellation latched across source ticks but re-arms a fresh semantic keyboard press', () => {
    const f = neutralFixture();
    try {
      f.sink.commit({ ...f.frame, revision: 3 });
      f.callbacks.at(-1)?.();
      f.send(0.5, 'cancel');
      f.callbacks.at(-1)?.();
      for (let revision = 2; revision <= 4; revision++) {
        f.source(true, revision);
        f.callbacks.at(-1)?.();
        expect(f.host.dataset.materialContact).toBe('rest');
        expect(optical.render.mock.calls.at(-1)?.[0]).toMatchObject({
          pressed: false,
          contact: { strength: 0 },
        });
      }
      // A real neutral semantic phase followed by pressed is distinct input;
      // source revision alone is not. No keyboard event is invented by the sink.
      f.sink.commit({ ...f.rest, revision: 4 });
      f.callbacks.at(-1)?.();
      f.sink.commit({ ...f.frame, revision: 5 });
      f.callbacks.at(-1)?.();
      expect(optical.render.mock.calls.at(-1)?.[0]).toMatchObject({
        pressed: true,
        contact: { strength: 1 },
      });
      expect(f.host.dataset.materialPhase).toBe('pressed');
    } finally {
      f.sink.release(1);
    }
  });
  it('rejects neutral bridge completion after a new pointer session replaces cancellation', () => {
    const f = neutralFixture();
    try {
      f.send(0.5, 'cancel');
      const cancelledDone = f.callbacks[0];
      f.send(0.8, 'down', 2);
      f.flushFrame();
      cancelledDone();
      expect(f.host.style.getPropertyValue('--pui-material-image')).toBe(f.neutral);
      f.callbacks.at(-1)?.();
      expect(f.host.dataset.materialContact).toBe('held');
      expect(f.host.dataset.materialContactSession).toBe('2');
    } finally {
      f.sink.release(1);
    }
  });
  it('re-admits neutral after cancellation reenters a held render without installing stale work', () => {
    const f = neutralFixture();
    try {
      optical.render.mockImplementationOnce(() => {
        f.send(0.5, 'cancel');
        return 'data:image/png;base64,cmVqZWN0ZWQ=';
      });
      f.source(true, 2);
      expect(f.host.style.getPropertyValue('--pui-material-image')).toBe(f.neutral);
      expect(f.callbacks).toHaveLength(1); // neutral only, never rejected held render
      f.callbacks[0]();
      expect(f.host.dataset.materialContact).toBe('rest');
      expect(f.host.style.getPropertyValue('--pui-material-image')).not.toContain('cmVqZWN0ZWQ=');
    } finally {
      f.sink.release(1);
    }
  });
  it('bounds retained decoded ownership to current plus one neutral and releases each exactly once', () => {
    const retirements: ReturnType<typeof vi.fn>[] = [];
    decoding.prepare.mockImplementation((_doc, _source, ready) => {
      const retire = vi.fn();
      retirements.push(retire);
      ready();
      return retire;
    });
    const f = setup();
    const live = () => retirements.filter((retire) => retire.mock.calls.length === 0).length;
    const rest: VisualFeedbackFrame = {
      ...f.frame,
      revision: 2,
      material: {
        ...f.frame.material,
        candidates: [
          {
            intent: 'liquid-glass',
            deformation: {
              kind: 'press',
              phase: 'rest',
              contact: 'pointer',
            },
          },
        ],
      },
    };
    f.sink.commit(rest);
    expect(live()).toBe(1);
    f.send(0.5, 'down');
    f.flushFrame();
    expect(live()).toBe(2);
    for (let i = 2; i < 6; i++) {
      f.source(true, i);
      expect(live()).toBe(2);
    }
    f.send(0.5, 'cancel');
    expect(live()).toBe(1);
    f.sink.release(1);
    expect(live()).toBe(0);
    expect(retirements.every((retire) => retire.mock.calls.length === 1)).toBe(true);
  });
  it('commits a new session even when its contact paint inputs match the previous session', () => {
    const f = setup();
    try {
      f.send(0.5, 'down', 1);
      f.flushFrame();
      const rendered = optical.render.mock.calls.length;
      // The router can replace a still-held session with the same coordinates.
      f.send(0.5, 'down', 2);
      f.flushFrame();
      expect(optical.render).toHaveBeenCalledTimes(rendered + 1);
      expect(f.host.dataset.materialContactSession).toBe('2');
    } finally {
      f.sink.release(1);
    }
  });
  it.each([
    'source revoked',
    'reduced transparency',
    'geometry changed',
    'material withdrawn',
    'contact cancelled',
    'view retired',
  ])('withdraws retained new-down paint when %s before the replacement decodes', (invalidation) => {
    const f = setup();
    try {
      const callbacks: Array<() => void> = [];
      decoding.prepare.mockImplementation((_doc, _source, ready) => {
        callbacks.push(ready);
        return () => {};
      });
      f.send(0.3, 'down');
      f.flushFrame();
      expect(f.host.dataset.materialQuality).toBe('self-optical');
      expect(f.host.style.getPropertyValue('--pui-material-image')).not.toBe('');
      expect(callbacks).toHaveLength(1);
      if (invalidation === 'source revoked') f.source(false);
      else if (invalidation === 'reduced transparency') f.transparency('reduce');
      else if (invalidation === 'geometry changed') {
        vi.mocked(f.host.getBoundingClientRect).mockReturnValue(rect(45, 30, 100, 40));
        f.invalidate();
      } else if (invalidation === 'material withdrawn')
        f.sink.commit({
          ...f.frame,
          revision: 2,
          material: { ...f.frame.material, candidates: [] },
        });
      else if (invalidation === 'contact cancelled') f.send(0.3, 'cancel');
      else f.sink.release(1);
      expect(f.host.style.getPropertyValue('--pui-material-image')).toBe('');
      callbacks[0]();
      expect(f.host.style.getPropertyValue('--pui-material-image')).toBe('');
    } finally {
      f.sink.release(1);
    }
  });
  it('keeps held contact through a Base style/phase transition while retiring its older decode', () => {
    const f = setup();
    f.send(0.5, 'down');
    f.flushFrame();
    const callbacks: Array<() => void> = [];
    const cancellations: Array<ReturnType<typeof vi.fn>> = [];
    decoding.prepare.mockImplementation((_doc, _source, ready) => {
      callbacks.push(ready);
      const cancel = vi.fn();
      cancellations.push(cancel);
      return cancel;
    });
    f.send(0.8);
    f.flushFrame();
    const prior = f.frame;
    const next: VisualFeedbackFrame = {
      ...prior,
      revision: 2,
      style: { kind: 'tw', tokens: [...prior.style.tokens, 'shadow-sm'] },
      material: {
        ...prior.material,
        candidates: [
          {
            intent: 'liquid-glass',
            deformation: { kind: 'press', phase: 'rest', contact: 'pointer' },
          },
        ],
      },
    };
    f.sink.commit(next);
    expect(cancellations[0]).toHaveBeenCalledOnce();
    expect(callbacks).toHaveLength(2);
    callbacks[0]();
    callbacks[1]();
    expect(f.host.dataset.materialContact).toBe('held');
    expect(f.host.dataset.materialPhase).toBe('rest');
    expect(optical.render.mock.calls.at(-1)?.[0]).toMatchObject({
      contact: { x: 0.8, strength: 1 },
    });
    f.sink.release(1);
  });
  it('atomically refreshes a live source frame without ending its held contact', () => {
    const f = setup();
    f.send(0.5, 'down');
    f.flushFrame();
    f.send(0.8);
    f.flushFrame();
    const previous = f.host.style.getPropertyValue('--pui-material-image');
    const callbacks: Array<() => void> = [];
    decoding.prepare.mockImplementation((_doc, _source, ready) => {
      callbacks.push(ready);
      return () => {};
    });
    f.source(true);
    expect(f.host.style.getPropertyValue('--pui-material-image')).toBe(previous);
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    expect(optical.render.mock.calls.at(-1)?.[0]).toMatchObject({
      source: { revision: 3 },
      contact: { x: 0.8, strength: 1 },
    });
    callbacks[0]();
    expect(f.host.dataset.materialSourceRevision).toBe('3');
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

describe('independent-review R2: failed carrier must become idle', () => {
  it.each(['marker-only negative control', 'real stylesheet refused by computed-style admission'])(
    '%s does not retry without external changes and recovers after a real edit',
    async (mode) => {
      const actual = await vi.importActual<typeof import('../src/material/contact-carrier')>(
        '../src/material/contact-carrier'
      );
      let refused = true;
      if (mode === 'marker-only negative control') {
        carrierControl.create = (host) => {
          host.setAttribute('data-pui-material-carrier', 'contact-v1');
          return {
            valid: () => !refused,
            release() {
              host.removeAttribute('data-pui-material-carrier');
            },
          };
        };
      } else {
        const nativeStyle = window.getComputedStyle.bind(window);
        vi.spyOn(window, 'getComputedStyle').mockImplementation((host, pseudo) => {
          if (!pseudo) return nativeStyle(host);
          // Models CSP/higher-priority CSS refusing the actual leased stylesheet.
          return { content: 'none', position: 'static' } as CSSStyleDeclaration;
        });
        carrierControl.create = actual.createContactCarrier;
      }
      const f = fixture();
      let frames: FrameRequestCallback[] = [];
      vi.mocked(window.requestAnimationFrame).mockImplementation((fn) => {
        frames.push(fn);
        return frames.length;
      });
      const base = f.frame(1);
      const frame: VisualFeedbackFrame = {
        ...base,
        material: {
          ...base.material,
          candidates: [
            {
              intent: 'liquid-glass',
              deformation: { kind: 'press', phase: 'rest', contact: 'pointer' },
            },
          ],
        },
      };
      f.sink.commit(frame);
      const counts = [optical.render.mock.calls.length];
      const turn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        const pending = frames;
        frames = [];
        pending.forEach((fn) => fn(performance.now()));
      };
      for (let i = 0; i < 5; i++) {
        await turn();
        counts.push(optical.render.mock.calls.length);
      }
      expect(counts).toEqual([1, 1, 1, 1, 1, 1]);
      expect(f.host.hasAttribute('data-pui-material-carrier')).toBe(false);
      // Source pixels cannot repair a stylesheet/CSP refusal. A live canvas
      // must not restart GPU readback, encode and decode for each new revision.
      for (let revision = 2; revision < 7; revision++) {
        f.source(true, revision);
        await turn();
      }
      expect(optical.render).toHaveBeenCalledTimes(1);
      const writer = createWebPointerContactWriter(f.host);
      writer.publish({
        active: true,
        session: 1,
        x: 0.5,
        y: 0.5,
        deltaX: 0,
        deltaY: 0,
        reason: 'down',
      });
      await turn();
      expect(optical.render).toHaveBeenCalledTimes(2);
      for (let i = 0; i < 5; i++) {
        writer.publish({
          active: true,
          session: 1,
          x: 0.6,
          y: 0.5,
          deltaX: 0.1,
          deltaY: 0,
          reason: 'move',
        });
        await turn();
      }
      expect(optical.render).toHaveBeenCalledTimes(2);
      // Genuine author change retries. The real-sheet case keeps refusing, but
      // still gets exactly one attempt instead of starting another retry loop.
      refused = false;
      f.host.className = 'author-fixed-carrier-style';
      await turn();
      expect(optical.render).toHaveBeenCalledTimes(3);
      if (mode === 'marker-only negative control')
        expect(f.host.dataset.materialQuality).toBe('self-optical');
      for (let i = 0; i < 5; i++) await turn();
      expect(optical.render).toHaveBeenCalledTimes(3);
      f.sink.release(1);
    }
  );
});

it('holds an image-transport failure across source revisions and retries changed preferences', () => {
  const f = fixture();
  decoding.prepare.mockImplementation((_doc, _source, _ready, failed) => {
    failed();
    return () => {};
  });
  f.sink.commit(f.frame(1));
  expect(optical.render).toHaveBeenCalledTimes(1);
  for (let revision = 2; revision < 7; revision++) f.source(true, revision);
  expect(optical.render).toHaveBeenCalledTimes(1);
  expect(f.host.dataset.materialReason).toBe('optical-image-decode-failed');
  f.motion('reduce');
  expect(optical.render).toHaveBeenCalledTimes(2);
  f.sink.release(1);
});

// Retained verbatim from the independent-review counterexample.
it.each([
  ['background-size', '25% 25%'],
  ['background-repeat', 'repeat'],
  ['background-origin', 'content-box'],
  ['background-clip', 'content-box'],
])(
  'independent: preserves external %s through subsequent source and semantic repaints',
  (property, replacement) => {
    const f = fixture();
    try {
      f.sink.commit(f.frame(1));
      f.host.style.setProperty(property, replacement, 'important');
      f.invalidate();
      expect(f.host.dataset.materialReason).toBe('external-paint-conflict');
      expect(f.host.style.getPropertyValue(property)).toBe(replacement);
      f.invalidate();
      console.log(
        'REPAINT_OVERRIDE',
        property,
        JSON.stringify({
          quality: f.host.dataset.materialQuality,
          value: f.host.style.getPropertyValue(property),
          priority: f.host.style.getPropertyPriority(property),
        })
      );
      expect(f.host.style.getPropertyValue(property)).toBe(replacement);
      expect(f.host.style.getPropertyPriority(property)).toBe('important');
      expect(f.host.dataset.materialQuality).not.toBe('self-optical');
      f.sink.commit(f.frame(2));
      expect(f.host.style.getPropertyValue(property)).toBe(replacement);
      expect(f.host.style.getPropertyPriority(property)).toBe('important');
    } finally {
      f.sink.release(1);
    }
  }
);

it.each([
  ['background-size', '25% 25%'],
  ['background-repeat', 'repeat'],
  ['background-origin', 'content-box'],
  ['background-clip', 'content-box'],
])(
  're-admits optics only after the author relinquishes the %s override',
  (property, replacement) => {
    const f = fixture();
    try {
      f.sink.commit(f.frame(1));
      const applied = f.host.style.getPropertyValue(property);
      f.host.style.setProperty(property, replacement, 'important');
      for (let revision = 2; revision <= 5; revision++) {
        f.source(true, revision);
        f.sink.commit(f.frame(revision));
        f.motion(revision % 2 === 0 ? 'reduce' : 'no-preference');
        expect(f.host.style.getPropertyValue(property)).toBe(replacement);
        expect(f.host.style.getPropertyPriority(property)).toBe('important');
        expect(f.host.dataset.materialQuality).not.toBe('self-optical');
        expect(f.host.dataset.materialReason).toBe('external-paint-conflict');
      }
      expect(optical.render).toHaveBeenCalledOnce();
      const changedReplacement =
        property === 'background-size'
          ? '50% 50%'
          : property === 'background-repeat'
            ? 'repeat-x'
            : 'padding-box';
      f.host.style.setProperty(property, changedReplacement, 'important');
      expect(f.host.style.getPropertyValue(property)).toBe(changedReplacement);
      f.source(true, 6);
      expect(f.host.style.getPropertyValue(property)).toBe(changedReplacement);
      expect(f.host.style.getPropertyPriority(property)).toBe('important');
      expect(f.host.dataset.materialQuality).not.toBe('self-optical');
      expect(optical.render).toHaveBeenCalledOnce();
      // Dropping priority is another author edit, not a release of its value.
      f.host.style.setProperty(property, changedReplacement);
      f.source(true, 7);
      expect(f.host.dataset.materialQuality).not.toBe('self-optical');
      expect(f.host.style.getPropertyValue(property)).toBe(changedReplacement);
      expect(f.host.style.getPropertyPriority(property)).toBe('');
      f.host.style.removeProperty(property);
      f.invalidate();
      expect(optical.render).toHaveBeenCalledTimes(2);
      expect(f.host.dataset.materialQuality).toBe('self-optical');
      expect(f.host.style.getPropertyValue(property)).toBe(applied);
      expect(f.host.style.getPropertyPriority(property)).toBe('');
      f.invalidate();
      expect(optical.render).toHaveBeenCalledTimes(2);
      f.sink.release(1);
      expect(f.host.style.getPropertyValue(property)).toBe('');
    } finally {
      f.sink.release(1);
    }
  }
);

it('keeps priority-only ownership replacement across repaint but can recover after removal', () => {
  const f = fixture();
  try {
    f.sink.commit(f.frame(1));
    const applied = f.host.style.backgroundSize;
    f.host.style.setProperty('background-size', applied, 'important');
    for (let revision = 2; revision <= 4; revision++) {
      f.source(true, revision);
      expect(f.host.dataset.materialQuality).not.toBe('self-optical');
      expect(f.host.style.backgroundSize).toBe(applied);
      expect(f.host.style.getPropertyPriority('background-size')).toBe('important');
    }
    expect(optical.render).toHaveBeenCalledOnce();
    f.host.style.removeProperty('background-size');
    f.invalidate();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    expect(optical.render).toHaveBeenCalledTimes(2);
  } finally {
    f.sink.release(1);
  }
});

it('retains simultaneous author takeovers until each declaration is removed', () => {
  const f = fixture();
  try {
    f.sink.commit(f.frame(1));
    f.host.style.setProperty('background-size', '25% 25%', 'important');
    f.host.style.setProperty('background-repeat', 'repeat', 'important');
    f.invalidate();
    f.host.style.removeProperty('background-size');
    f.invalidate();
    expect(f.host.dataset.materialQuality).not.toBe('self-optical');
    expect(f.host.style.backgroundRepeat).toBe('repeat');
    expect(f.host.style.getPropertyPriority('background-repeat')).toBe('important');
    expect(optical.render).toHaveBeenCalledOnce();
    f.host.style.removeProperty('background-repeat');
    f.invalidate();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    expect(optical.render).toHaveBeenCalledTimes(2);
  } finally {
    f.sink.release(1);
  }
});

it('retains author ownership when preferences revoke paint before the style observer runs', () => {
  const f = fixture();
  try {
    f.sink.commit(f.frame(1));
    f.host.style.setProperty('background-size', '25% 25%', 'important');
    f.motion('reduce');
    f.invalidate();
    expect(f.host.dataset.materialQuality).not.toBe('self-optical');
    expect(f.host.style.backgroundSize).toBe('25% 25%');
    expect(f.host.style.getPropertyPriority('background-size')).toBe('important');
    f.sink.release(1);
    f.source(true, 2);
    expect(f.host.style.backgroundSize).toBe('25% 25%');
    expect(f.host.dataset.materialQuality).toBeUndefined();
  } finally {
    f.sink.release(1);
  }
});
