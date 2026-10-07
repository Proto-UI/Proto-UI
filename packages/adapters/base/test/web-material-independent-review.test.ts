import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import { inspectOpticalImageResources } from '../src/material/image-prepare';
import { createWebMaterialSink } from '../src/material/sink';
import type { CanvasBackdropFrame, CanvasBackdropLease } from '../src/material/source';
const optical = vi.hoisted(() => ({
  render: vi.fn((_frame: unknown) => 'data:image/png;base64,AA=='),
  clear: vi.fn(),
}));
vi.mock('../src/material/program', () => ({ createWebOpticalProgram: () => optical }));
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
    setDelayed(value: boolean) {
      delayed = value;
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

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it.each(['pending', 'decoded'] as const)(
  'independent: retiring %s sink releases its real image preparer',
  async (state) => {
    let done = () => {};
    const image = {
      src: '',
      complete: true,
      naturalWidth: 100,
      decode: () =>
        new Promise<void>((r) => {
          done = r;
        }),
    };
    vi.spyOn(window, 'Image').mockImplementation(() => image as unknown as HTMLImageElement);
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const before = inspectOpticalImageResources(document);
    const f = fixture();
    f.sink.commit(f.frame(1));
    if (state === 'decoded') {
      done();
      await Promise.resolve();
      expect(f.host.dataset.materialQuality).toBe('self-optical');
    }
    f.sink.release(1);
    expect(inspectOpticalImageResources(document)).toMatchObject({
      pendingImages: before.pendingImages,
      decodedImages: before.decodedImages,
    });
    expect(image.src).toBe('');
  }
);
it('independent: late decode does not overwrite newly introduced external paint', async () => {
  let done = () => {};
  const image = {
    src: '',
    complete: true,
    naturalWidth: 100,
    decode: () =>
      new Promise<void>((r) => {
        done = r;
      }),
  };
  vi.spyOn(window, 'Image').mockImplementation(() => image as unknown as HTMLImageElement);
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const f = fixture();
  f.sink.commit(f.frame(1));
  f.host.style.backgroundImage = 'linear-gradient(red, blue)';
  done();
  await Promise.resolve();
  expect(f.host.dataset.materialQuality).not.toBe('self-optical');
  expect(f.host.style.backgroundImage).toBe('linear-gradient(red, blue)');
  f.sink.release(1);
});
it('independent: rejected late decode does not overwrite newly introduced external paint', async () => {
  let fail = (_: Error) => {};
  const image = {
    src: '',
    complete: true,
    naturalWidth: 100,
    decode: () =>
      new Promise<void>((_r, reject) => {
        fail = reject;
      }),
  };
  vi.spyOn(window, 'Image').mockImplementation(() => image as unknown as HTMLImageElement);
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const f = fixture();
  f.sink.commit(f.frame(1));
  f.host.style.backgroundImage = 'linear-gradient(red, blue)';
  fail(new Error('decode-failed'));
  await Promise.resolve();
  expect(f.host.style.backgroundImage).toBe('linear-gradient(red, blue)');
  f.sink.release(1);
});
it('independent: rejected decode after palette getter failure preserves ordinary style', async () => {
  let fail = (_: Error) => {};
  const image = {
    src: '',
    complete: true,
    naturalWidth: 100,
    decode: () =>
      new Promise<void>((_r, reject) => {
        fail = reject;
      }),
  };
  vi.spyOn(window, 'Image').mockImplementation(() => image as unknown as HTMLImageElement);
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const f = fixture();
  f.sink.commit(f.frame(1));
  f.failPalette();
  fail(new Error('decode-failed'));
  await Promise.resolve();
  expect(f.host.style.backgroundColor).toBe('');
  expect(f.host.dataset.materialQuality).toBe('unavailable');
  f.sink.release(1);
});

it.each(['pending', 'decoded'] as const)(
  'independent: newer undelivered style retires previous %s image',
  async (state) => {
    let done = () => {};
    const image = {
      src: '',
      complete: true,
      naturalWidth: 100,
      decode: () =>
        new Promise<void>((r) => {
          done = r;
        }),
    };
    vi.spyOn(window, 'Image').mockImplementation(() => image as unknown as HTMLImageElement);
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const before = inspectOpticalImageResources(document);
    const f = fixture();
    f.sink.commit(f.frame(1));
    if (state === 'decoded') {
      done();
      await Promise.resolve();
    }
    f.setDelayed(true);
    f.sink.commit(f.frame(2, ['bg-background', 'text-foreground', 'rounded-full']));
    expect(f.host.dataset.materialReason).toBe('final-style-host-commit-pending');
    expect(inspectOpticalImageResources(document)).toMatchObject({
      pendingImages: before.pendingImages,
      decodedImages: before.decodedImages,
    });
    expect(image.src).toBe('');
    f.sink.release(1);
  }
);
