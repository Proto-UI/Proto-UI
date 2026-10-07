import { afterEach, describe, expect, it, vi } from 'vitest';
import { tw } from '@proto.ui/core';
import {
  finalStyleFrame,
  type FinalStyleSink,
} from '../../../modules/feedback/src/material/final-style-sink';
import type { OwnedMaterialConfig } from '../../../modules/feedback/src/material/owned-slot';
import button from '../../../../experiments/material-specializer/button.proto';
import { createOwnedTwTokenApplier } from '../src/feedback-style';
import {
  createOwnedTextureVisualSink,
  type OwnedTexture,
} from '../src/material/owned-texture-sink';
import { createOwnedVisualSurface, isOwnedVisualNode } from '../src/visual-surface';

type Boundary =
  | 'preferences.current'
  | 'source.current'
  | 'prepareSource'
  | 'bounds'
  | 'writeFrame'
  | 'final source.current';

// These tests execute the real private sink, token applier and visual surface in
// happy-dom. Geometry, WebGL and observer delivery are deterministic injections;
// the white readback is not shader, optical, browser-paint or profile evidence.
function harness() {
  const host = document.createElement('div');
  const content = document.createElement('span');
  content.textContent = 'Retained application content';
  host.append(content);
  host.className = 'author-class';
  host.style.setProperty('background', 'rgb(20, 40, 60)', 'important');
  host.style.setProperty('position', 'absolute', 'important');
  host.style.setProperty('isolation', 'auto', 'important');
  host.dataset.materialQuality = 'author-quality';
  host.dataset.materialReason = 'author-reason';
  document.body.append(host);

  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    color: 'rgb(0, 0, 0)',
    opacity: '1',
    transform: 'none',
    rotate: 'none',
    scale: 'none',
    translate: 'none',
    filter: 'none',
    backdropFilter: 'none',
    position: 'absolute',
    borderTopLeftRadius: '2px',
    borderTopRightRadius: '2px',
    borderBottomLeftRadius: '2px',
    borderBottomRightRadius: '2px',
  } as CSSStyleDeclaration);
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 8, 8));

  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++sequence, callback);
    return sequence;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  let resize = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    }
  );

  const gl = {
    NO_ERROR: 0,
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TEXTURE0: 8,
    TEXTURE_2D: 9,
    TEXTURE_MIN_FILTER: 10,
    TEXTURE_MAG_FILTER: 11,
    LINEAR: 12,
    TEXTURE_WRAP_S: 13,
    TEXTURE_WRAP_T: 14,
    CLAMP_TO_EDGE: 15,
    RGBA: 16,
    UNSIGNED_BYTE: 17,
    UNPACK_ALIGNMENT: 18,
    COLOR_BUFFER_BIT: 19,
    BLEND: 20,
    TRIANGLE_STRIP: 21,
    createShader: vi.fn(() => ({})),
    createProgram: vi.fn(() => ({})),
    createBuffer: vi.fn(() => ({})),
    createTexture: vi.fn(() => ({})),
    deleteShader: vi.fn(),
    deleteProgram: vi.fn(),
    deleteBuffer: vi.fn(),
    deleteTexture: vi.fn(),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    activeTexture: vi.fn(),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    viewport: vi.fn(),
    pixelStorei: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    disable: vi.fn(),
    drawArrays: vi.fn(),
    finish: vi.fn(),
    getError: vi.fn(() => 0),
    isContextLost: vi.fn(() => false),
    readPixels: vi.fn(
      (
        _x: number,
        _y: number,
        _w: number,
        _h: number,
        _format: number,
        _type: number,
        pixels: Uint8Array
      ) => {
        pixels.fill(255);
      }
    ),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    gl as unknown as WebGLRenderingContext
  );
  const style = createOwnedTwTokenApplier(host);
  const clear = vi.spyOn(style, 'clear');
  const surface = createOwnedVisualSurface(host, host);
  const mount = vi.spyOn(surface, 'mount');
  const release = vi.spyOn(surface, 'release');
  const offSource = vi.fn();
  const offPreferences = vi.fn();
  let invalidateSource = () => {};
  let invalidatePreferences = () => {};
  let trigger: ((boundary: Boundary) => void) | undefined;
  let sourceReads = 0;
  let replaceAtFinalRead = false;
  const texture: OwnedTexture = {
    generation: 1,
    width: 1,
    height: 1,
    pixels: new Uint8Array([255, 255, 255, 255]),
    bounds: () => {
      trigger?.('bounds');
      return [0, 0, 1, 1];
    },
  };
  const sink: FinalStyleSink = createOwnedTextureVisualSink(
    host,
    style,
    {
      vertex: '',
      fragment: '',
      uniforms: [],
      prepareSource(pixels) {
        trigger?.('prepareSource');
        return pixels;
      },
      writeFrame() {
        trigger?.('writeFrame');
      },
    },
    {
      current() {
        sourceReads++;
        trigger?.(sourceReads === 2 ? 'final source.current' : 'source.current');
        // Object identity is deliberately unstable; matching generation and
        // dimensions are the existing provider freshness contract.
        return { ...texture, generation: replaceAtFinalRead && sourceReads === 2 ? 2 : 1 };
      },
      subscribe(callback) {
        invalidateSource = callback;
        return offSource;
      },
    },
    {
      current() {
        trigger?.('preferences.current');
        return {
          reducedMotion: 'no-preference',
          reducedTransparency: 'no-preference',
          contrast: 'no-preference',
          forcedColors: 'none',
        };
      },
      subscribe(callback) {
        invalidatePreferences = callback;
        return offPreferences;
      },
    },
    surface
  );
  const frame = finalStyleFrame(tw('rounded-full'), 1, 1, {
    config: button.modules![0].config as OwnedMaterialConfig,
    pressed: false,
    disabled: false,
    bindingsReady: true,
  });
  const interrupted = vi.fn();
  return {
    host,
    gl,
    mount,
    frames,
    sink,
    frame,
    interrupted,
    offSource,
    commit: () => sink.commit(frame),
    replaceAtFinalRead: () => {
      replaceAtFinalRead = true;
    },
    arm(boundary: Boundary, throwing: boolean) {
      trigger = (current) => {
        if (current !== boundary) return;
        trigger = undefined;
        interrupted();
        sink.release(1);
        if (throwing) throw new Error('callback failed after terminal release');
      };
    },
    tick() {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(0));
    },
    expectRetired(mounts: number) {
      expect(release).toHaveBeenCalledOnce();
      const canvas = release.mock.calls[0][0] as HTMLCanvasElement;
      expect(mount).toHaveBeenCalledTimes(mounts);
      expect(canvas.parentNode).toBeNull();
      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
      expect(isOwnedVisualNode(host, canvas)).toBe(false);
      expect(host.children).toHaveLength(1);
      expect(host.firstElementChild).toBe(content);
      expect(host.className).toBe('author-class');
      expect(host.getAttribute('data-pui-style')).toBeNull();
      expect(host.style.background).toBe('rgb(20, 40, 60)');
      expect(host.style.position).toBe('absolute');
      expect(host.style.isolation).toBe('auto');
      for (const property of ['background', 'position', 'isolation'])
        expect(host.style.getPropertyPriority(property)).toBe('important');
      expect({ ...host.dataset }).toEqual({
        materialQuality: 'author-quality',
        materialReason: 'author-reason',
      });
      for (const [create, remove] of [
        [gl.createShader, gl.deleteShader],
        [gl.createProgram, gl.deleteProgram],
        [gl.createBuffer, gl.deleteBuffer],
        [gl.createTexture, gl.deleteTexture],
      ] as const) {
        expect(remove).toHaveBeenCalledTimes(create.mock.results.length);
        for (const { value } of create.mock.results)
          expect(remove.mock.calls.filter(([resource]) => resource === value)).toHaveLength(1);
      }
      expect(offSource).toHaveBeenCalledOnce();
      expect(offPreferences).toHaveBeenCalledOnce();
      expect(disconnect).toHaveBeenCalledOnce();
      expect(clear).toHaveBeenCalledOnce();
      expect(frames.size).toBe(0);

      // Detached subscriptions and already-delivered observer callbacks cannot
      // make a terminal sink live again, even if invoked by a stale provider.
      const retiredHTML = host.outerHTML;
      const draws = gl.drawArrays.mock.calls.length;
      invalidateSource();
      invalidatePreferences();
      resize();
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
      canvas.dispatchEvent(new Event('webglcontextrestored'));
      sink.release(1);
      expect(() => sink.commit(frame)).toThrow('Retired material visual sink');
      expect(host.outerHTML).toBe(retiredHTML);
      expect(gl.drawArrays).toHaveBeenCalledTimes(draws);
      expect(mount).toHaveBeenCalledTimes(mounts);
      expect(release).toHaveBeenCalledOnce();
      expect(frames.size).toBe(0);
    },
    cleanup() {
      sink.release(1);
      host.remove();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('owned material terminal release during provider callbacks (host-unit)', () => {
  for (const boundary of [
    'preferences.current',
    'source.current',
    'prepareSource',
    'bounds',
    'writeFrame',
    'final source.current',
  ] as const)
    for (const throwing of [false, true])
      it(`does not resume after ${boundary} releases and ${throwing ? 'throws' : 'returns'}`, () => {
        const h = harness();
        try {
          h.arm(boundary, throwing);
          h.commit();
          expect(h.interrupted).toHaveBeenCalledOnce();
          h.expectRetired(0);
          expect(h.gl.drawArrays).toHaveBeenCalledTimes(
            boundary === 'final source.current' ? 1 : 0
          );
          expect(h.gl.createProgram).toHaveBeenCalledTimes(
            boundary === 'writeFrame' || boundary === 'final source.current' ? 1 : 0
          );
        } finally {
          h.cleanup();
        }
      });

  for (const boundary of ['source.current', 'bounds'] as const)
    for (const throwing of [false, true])
      it(`keeps geometry observation retired when ${boundary} releases and ${throwing ? 'throws' : 'returns'}`, () => {
        const h = harness();
        try {
          h.commit();
          expect(h.host.dataset.materialQuality).toBe('experimental-owned-texture');
          expect(h.frames.size).toBe(1);
          h.arm(boundary, throwing);
          h.tick();
          expect(h.interrupted).toHaveBeenCalledOnce();
          h.expectRetired(1);
          expect(h.gl.drawArrays).toHaveBeenCalledOnce();
        } finally {
          h.cleanup();
        }
      });

  it('renders equal-generation fresh snapshots normally, then releases every owned resource', () => {
    const h = harness();
    try {
      h.commit();
      expect(h.host.dataset.materialQuality).toBe('experimental-owned-texture');
      expect(h.host.dataset.materialReason).toBe('rendered');
      expect(h.host.dataset.materialFrame).toBe('1');
      expect(h.host.querySelector('canvas')?.style.display).toBe('block');
      expect(h.gl.drawArrays).toHaveBeenCalledOnce();
      expect(h.gl.createTexture).toHaveBeenCalledTimes(3);
      h.tick();
      expect(h.gl.drawArrays).toHaveBeenCalledOnce();
      expect(h.frames.size).toBe(1);
      h.sink.release(1);
      h.expectRetired(1);
    } finally {
      h.cleanup();
    }
  });

  it('still publishes readable fallback for a live source replacement during a frame', () => {
    const h = harness();
    try {
      h.replaceAtFinalRead();
      h.commit();
      expect(h.host.dataset.materialQuality).toBe('opaque-fallback');
      expect(h.host.dataset.materialReason).toBe('source-replaced-during-frame');
      expect(h.mount).not.toHaveBeenCalled();
      expect(h.gl.drawArrays).toHaveBeenCalledOnce();
      h.sink.release(1);
      h.expectRetired(0);
    } finally {
      h.cleanup();
    }
  });
});
