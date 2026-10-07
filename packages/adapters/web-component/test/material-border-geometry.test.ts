import { afterEach, describe, expect, it, vi } from 'vitest';
import { tw } from '@proto.ui/core';
import { finalStyleFrame } from '../../../modules/feedback/src/material/final-style-sink';
import type { OwnedMaterialConfig } from '../../../modules/feedback/src/material/owned-slot';
import button from '../../../../experiments/material-specializer/button.proto';
import { createOwnedTwTokenApplier } from '../src/feedback-style';
import {
  createOwnedTextureVisualSink,
  type MaterialProgram,
} from '../src/material/owned-texture-sink';

// This repository-owned validator is emitted verbatim into the real target writer.
const frameValidatorPath = '../../../../experiments/material-specializer/frame-validation.mjs';
const { validateFrame } = (await import(frameValidatorPath)) as {
  validateFrame(frame: unknown): void;
};

type Borders = [number, number, number, number]; // top, right, bottom, left

type Frame = {
  viewport: number[];
  boxSize: number[];
  bounds: number[];
  radius: number;
};

// Host-unit evidence only: the real sink receives injected used CSS/host bounds,
// observer delivery and opaque WebGL readback. These assertions check frame and
// CSS assignment consistency, not browser layout, clipping, pixels or optics.
// Accepted draft direction: C-FEEDBACK-MATERIAL-0001-GEOMETRY/OWNERSHIP.
// Absolute 100% canvas dimensions use the host's padding box:
// https://www.w3.org/TR/CSS22/visudet.html#containing-block-details
function harness({
  borders = [0, 0, 0, 0],
  radius = 12,
  boxSizing = 'content-box',
  padding = 8,
  dpr = 1,
  hostSize = [120, 80],
  providerBounds = [0.1, 0.2, 0.4, 0.3],
}: {
  borders?: Borders;
  radius?: number;
  boxSizing?: string;
  padding?: number;
  dpr?: number;
  hostSize?: [number, number];
  providerBounds?: [number, number, number, number];
} = {}) {
  const host = document.createElement('div');
  host.textContent = 'Application content';
  document.body.append(host);
  const rect = new DOMRect(100, 70, ...hostSize);
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(rect);
  const css = {
    color: 'rgb(0, 0, 0)',
    opacity: '1',
    transform: 'none',
    rotate: 'none',
    scale: 'none',
    translate: 'none',
    filter: 'none',
    mixBlendMode: 'normal',
    position: 'relative',
    boxSizing,
    paddingTop: `${padding}px`,
    paddingRight: `${padding}px`,
    paddingBottom: `${padding}px`,
    paddingLeft: `${padding}px`,
    borderTopLeftRadius: `${radius}px`,
    borderTopRightRadius: `${radius}px`,
    borderBottomLeftRadius: `${radius}px`,
    borderBottomRightRadius: `${radius}px`,
    borderTopWidth: '',
    borderRightWidth: '',
    borderBottomWidth: '',
    borderLeftWidth: '',
  };
  function setBorders(next: Borders) {
    [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth] =
      next.map((value) => `${value}px`);
  }
  setBorders(borders);
  vi.spyOn(window, 'getComputedStyle').mockReturnValue(css as CSSStyleDeclaration);
  vi.stubGlobal('devicePixelRatio', dpr);
  const pending = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    pending.set(++sequence, callback);
    return sequence;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    pending.delete(id);
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  const methods = Object.fromEntries(
    [
      'deleteShader',
      'deleteProgram',
      'deleteBuffer',
      'deleteTexture',
      'shaderSource',
      'compileShader',
      'attachShader',
      'linkProgram',
      'useProgram',
      'bindBuffer',
      'bufferData',
      'enableVertexAttribArray',
      'vertexAttribPointer',
      'activeTexture',
      'bindTexture',
      'texParameteri',
      'texImage2D',
      'viewport',
      'pixelStorei',
      'clearColor',
      'clear',
      'disable',
      'drawArrays',
      'finish',
    ].map((name) => [name, vi.fn()])
  );
  const gl = {
    ...methods,
    NO_ERROR: 0,
    createShader: vi.fn(() => ({})),
    createProgram: vi.fn(() => ({})),
    createBuffer: vi.fn(() => ({})),
    createTexture: vi.fn(() => ({})),
    getShaderParameter: vi.fn(() => true),
    getProgramParameter: vi.fn(() => true),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({})),
    getError: vi.fn(() => 0),
    isContextLost: vi.fn(() => false),
    readPixels: vi.fn((...args: unknown[]) => (args.at(-1) as Uint8Array).fill(255)),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    gl as unknown as WebGLRenderingContext
  );
  const sourceBounds: [number, number, number, number] = [...providerBounds];
  const bounds = vi.fn(() => [...sourceBounds] as typeof sourceBounds);
  const texture = {
    generation: 1,
    width: 1,
    height: 1,
    pixels: new Uint8Array([255, 255, 255, 255]),
    bounds,
  };
  const writeFrame = vi.fn<MaterialProgram['writeFrame']>((_gl, _locations, frame) => {
    validateFrame(frame);
  });
  const sink = createOwnedTextureVisualSink(
    host,
    createOwnedTwTokenApplier(host),
    { vertex: '', fragment: '', uniforms: [], writeFrame },
    { current: () => texture, subscribe: () => () => {} },
    {
      current: () => ({
        reducedMotion: 'no-preference',
        reducedTransparency: 'no-preference',
        contrast: 'no-preference',
        forcedColors: 'none',
      }),
      subscribe: () => () => {},
    }
  );
  sink.commit(
    finalStyleFrame(tw('rounded-full'), 1, 1, {
      config: button.modules![0].config as OwnedMaterialConfig,
      pressed: false,
      disabled: false,
      bindingsReady: true,
    })
  );
  return {
    host,
    sink,
    css,
    rect,
    writeFrame,
    setBorders,
    bounds,
    sourceBounds,
    frame: () => writeFrame.mock.lastCall![2] as Frame,
    canvas: () => host.querySelector('canvas')!,
    tick() {
      const first = pending.entries().next().value;
      expect(first, 'geometry observation remains live').toBeDefined();
      const [id, callback] = first!;
      pending.delete(id);
      callback(0);
    },
  };
}

function expectBounds(actual: number[], expected: number[]) {
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 12));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('owned material padding-box geometry', () => {
  it('keeps padding in the borderless canvas/frame and leaves provider bounds unchanged', () => {
    const h = harness({ padding: 17 });
    try {
      expect(h.host.dataset.materialQuality).toBe('experimental-owned-texture');
      expect(h.frame()).toMatchObject({ viewport: [120, 80], boxSize: [120, 80], radius: 12 });
      expect(h.frame().bounds).toEqual(h.sourceBounds);
      expect([h.canvas().width, h.canvas().height]).toEqual([120, 80]);
      expect(h.canvas().style.borderRadius).toBe('12px');
    } finally {
      h.sink.release(1);
    }
  });

  it.each(['content-box', 'border-box'])('matches a uniform border on a %s host', (boxSizing) => {
    const h = harness({ borders: [2, 2, 2, 2], boxSizing, padding: 17 });
    try {
      expect(h.host.dataset.materialQuality).toBe('experimental-owned-texture');
      expect(h.frame()).toMatchObject({ viewport: [116, 76], boxSize: [116, 76], radius: 10 });
      expect([h.canvas().width, h.canvas().height]).toEqual([116, 76]);
      expect(h.canvas().style.borderRadius).toBe('10px');
      expectBounds(h.frame().bounds, [
        0.1 + (0.4 * 2) / 120,
        0.2 + (0.3 * 2) / 80,
        (0.4 * 116) / 120,
        (0.3 * 76) / 80,
      ]);
      expect(h.bounds).toHaveBeenCalledWith(h.host);
      expect(h.sourceBounds).toEqual([0.1, 0.2, 0.4, 0.3]);
      const paints = h.writeFrame.mock.calls.length;
      h.tick();
      h.tick();
      expect(h.writeFrame).toHaveBeenCalledTimes(paints);
    } finally {
      h.sink.release(1);
    }
  });

  for (const axis of ['right', 'bottom'] as const)
    it(`keeps a valid ${axis}-edge provider extent within its bound after insetting`, () => {
      const h = harness({
        borders: axis === 'right' ? [0, 0, 0, 5] : [5, 0, 0, 0],
        radius: 0,
        hostSize: axis === 'right' ? [192, 80] : [80, 192],
        providerBounds: axis === 'right' ? [0.2, 0, 0.8, 1] : [0, 0.2, 1, 0.8],
      });
      try {
        expect(h.host.dataset.materialQuality).toBe('experimental-owned-texture');
        const [x, y, width, height] = h.frame().bounds;
        expect(x + width).toBeLessThanOrEqual(1);
        expect(y + height).toBeLessThanOrEqual(1);
        expect(axis === 'right' ? x + width : y + height).toBe(1);
        expect(() => validateFrame(h.frame())).not.toThrow();
      } finally {
        h.sink.release(1);
      }
    });

  it('supports asymmetric borders when the derived corners are all square', () => {
    const h = harness({ borders: [2, 6, 4, 8], radius: 0, padding: 11 });
    try {
      expect(h.host.dataset.materialQuality).toBe('experimental-owned-texture');
      expect(h.frame()).toMatchObject({ viewport: [106, 74], boxSize: [106, 74], radius: 0 });
      expectBounds(h.frame().bounds, [
        0.1 + (0.4 * 8) / 120,
        0.2 + (0.3 * 2) / 80,
        (0.4 * 106) / 120,
        (0.3 * 74) / 80,
      ]);
    } finally {
      h.sink.release(1);
    }
  });

  it('clamps the outer style radius before deriving a thick-border inner radius', () => {
    const h = harness({ borders: [5, 5, 5, 5], radius: 100 });
    try {
      expect(h.frame()).toMatchObject({ viewport: [110, 70], boxSize: [110, 70], radius: 35 });
      expect(h.canvas().style.borderRadius).toBe('35px');
    } finally {
      h.sink.release(1);
    }
  });

  it('retains fractional CSS geometry while rounding only the physical buffer', () => {
    const h = harness({ borders: [0.5, 0.5, 0.5, 0.5], radius: 4.25, dpr: 1.5 });
    try {
      expect(h.frame()).toMatchObject({
        viewport: [179, 119],
        boxSize: [178.5, 118.5],
        radius: 3.75,
      });
      expect([h.canvas().width, h.canvas().height]).toEqual([179, 119]);
      expect(h.canvas().style.borderRadius).toBe('3.75px');
    } finally {
      h.sink.release(1);
    }
  });

  it('admits square inner corners when one elliptical axis is fully covered by border', () => {
    const h = harness({ borders: [3, 0, 3, 0], radius: 2 });
    try {
      expect(h.host.dataset.materialQuality).toBe('experimental-owned-texture');
      expect(h.frame()).toMatchObject({ viewport: [120, 74], boxSize: [120, 74], radius: 0 });
    } finally {
      h.sink.release(1);
    }
  });

  it('falls back for an empty padding-box canvas instead of allocating the outer box', () => {
    const h = harness({ borders: [40, 1, 40, 1], radius: 0 });
    try {
      expect(h.host.dataset.materialQuality).toBe('opaque-fallback');
      expect(h.host.dataset.materialReason).toBe('geometry-budget');
      expect(h.writeFrame).not.toHaveBeenCalled();
    } finally {
      h.sink.release(1);
    }
  });

  it('does not let the border inset disguise invalid original provider bounds', () => {
    const h = harness({ borders: [2, 2, 2, 2], providerBounds: [-0.005, 0.2, 0.4, 0.3] });
    try {
      // Insetting this tuple would produce a positive x, but the provider's
      // original host mapping is outside the owned texture and remains invalid.
      expect(h.host.dataset.materialQuality).toBe('opaque-fallback');
      expect(h.host.dataset.materialReason).toBe('invalid-owned-source-bounds');
      expect(h.writeFrame).not.toHaveBeenCalled();
    } finally {
      h.sink.release(1);
    }
  });

  it('revokes the retained drawing buffer when observed original bounds become invalid', () => {
    const h = harness({ borders: [2, 2, 2, 2] });
    try {
      const canvas = h.canvas();
      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
      h.sourceBounds[0] = -0.005;
      h.tick();
      expect(h.host.dataset.materialQuality).toBe('opaque-fallback');
      expect(h.host.dataset.materialReason).toBe('invalid-owned-source-bounds');
      expect([canvas.width, canvas.height]).toEqual([0, 0]);
      expect(canvas.style.display).toBe('none');
    } finally {
      h.sink.release(1);
    }
  });

  it('does not invent one circular radius for genuinely elliptical inner corners', () => {
    const h = harness({ borders: [2, 6, 2, 6], radius: 12 });
    try {
      expect(h.host.dataset.materialQuality).toBe('opaque-fallback');
      expect(h.host.dataset.materialReason).toBe('geometry-unavailable');
      expect(h.writeFrame).not.toHaveBeenCalled();
    } finally {
      h.sink.release(1);
    }
  });

  it('observes border-only changes with unchanged host bounds and source generation', () => {
    const h = harness({ borders: [2, 2, 2, 2], boxSizing: 'border-box' });
    try {
      const paints = h.writeFrame.mock.calls.length;
      h.setBorders([4, 4, 4, 4]);
      h.tick();
      expect(h.writeFrame).toHaveBeenCalledTimes(paints + 1);
      expect(h.frame()).toMatchObject({ viewport: [112, 72], boxSize: [112, 72], radius: 8 });
      expectBounds(h.frame().bounds, [
        0.1 + (0.4 * 4) / 120,
        0.2 + (0.3 * 4) / 80,
        (0.4 * 112) / 120,
        (0.3 * 72) / 80,
      ]);
      h.tick();
      expect(h.writeFrame).toHaveBeenCalledTimes(paints + 1);
      h.setBorders([0, 0, 0, 0]);
      h.tick();
      expect(h.writeFrame).toHaveBeenCalledTimes(paints + 2);
      expect(h.frame()).toMatchObject({ viewport: [120, 80], boxSize: [120, 80], radius: 12 });
      expect(h.frame().bounds).toEqual(h.sourceBounds);
    } finally {
      h.sink.release(1);
    }
  });

  it('resamples a changed asymmetric inset even when outer and inner sizes are unchanged', () => {
    const h = harness({ borders: [2, 6, 4, 8], radius: 0, boxSizing: 'border-box' });
    try {
      const paints = h.writeFrame.mock.calls.length;
      const before = h.frame().bounds[0];
      h.setBorders([2, 8, 4, 6]);
      h.tick();
      expect(h.writeFrame).toHaveBeenCalledTimes(paints + 1);
      expect(h.frame()).toMatchObject({ viewport: [106, 74], boxSize: [106, 74], radius: 0 });
      expect(h.frame().bounds[0]).toBeCloseTo(0.1 + (0.4 * 6) / 120, 12);
      expect(h.frame().bounds[0]).not.toBe(before);
      h.tick();
      expect(h.writeFrame).toHaveBeenCalledTimes(paints + 1);
    } finally {
      h.sink.release(1);
    }
  });

  it('recovers from incompatible inner corners when only border geometry changes', () => {
    const h = harness({ borders: [2, 6, 2, 6], radius: 12 });
    try {
      expect(h.host.dataset.materialQuality).toBe('opaque-fallback');
      h.setBorders([2, 2, 2, 2]);
      h.tick();
      expect(h.host.dataset.materialQuality).toBe('experimental-owned-texture');
      expect(h.frame()).toMatchObject({ viewport: [116, 76], boxSize: [116, 76], radius: 10 });
      const paints = h.writeFrame.mock.calls.length;
      h.tick();
      expect(h.writeFrame).toHaveBeenCalledTimes(paints);
    } finally {
      h.sink.release(1);
    }
  });
});
