import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  createLibraryLiquidMaterialSink,
  initLibraryLiquidScenes,
  installLibraryLiquidCandidateHarness,
  drawLibraryLiquidBackdrop,
} from './library-liquid-scene';
const bounds = (width: number, height: number) =>
  ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    width,
    height,
    right: width,
    bottom: height,
    toJSON() {
      return { x: 0, y: 0, width, height };
    },
  }) as DOMRect;
function fixture(direct = true) {
  const owner = document.createElement('div');
  owner.dataset.libraryLiquidScene = '';
  const canvas = document.createElement('canvas');
  canvas.dataset.libraryLiquidCanvas = '';
  const link = document.createElement('a');
  link.href = '/target';
  link.dataset.libraryAction = '';
  const wrapper = document.createElement('span');
  wrapper.dataset.libraryLiquidOptical = '';
  const target = document.createElement('wc-library-liquid-optical-surface');
  target.dataset.libraryPart = 'liquid-glass-surface';
  wrapper.append(target);
  link.append(wrapper);
  if (direct) owner.append(canvas);
  else {
    const other = document.createElement('div');
    other.append(canvas);
    owner.append(other);
  }
  owner.append(link);
  document.body.append(owner);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(bounds(320, 180));
  vi.spyOn(owner, 'getBoundingClientRect').mockReturnValue(bounds(320, 180));
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    ...bounds(180, 48),
    x: 40,
    y: 40,
    left: 40,
    top: 40,
    right: 220,
    bottom: 88,
  });
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    getImageData: () => ({
      data: new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(255),
    }),
  };
  vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  return { owner, canvas, link, target, context };
}
beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
});
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('draws an opaque first-party scene with observable edges, without external source or text', () => {
  const f = fixture();
  drawLibraryLiquidBackdrop(f.context as unknown as CanvasRenderingContext2D, 320, 180, false);
  expect(f.context.fillRect.mock.calls[0]).toEqual([0, 0, 320, 180]);
  expect(f.context.createRadialGradient).toHaveBeenCalledTimes(3);
  expect(f.context.stroke).toHaveBeenCalledTimes(5);
});
it('creates only the directly owned visible Canvas and scopes the material provider to the one actual action', () => {
  const f = fixture(),
    release = initLibraryLiquidScenes(document),
    removeHarness = installLibraryLiquidCandidateHarness(document);
  const harness = (window as any).libraryLiquidCardCandidate;
  const state = harness.state();
  expect(state.sourceRevision).toBe(1);
  expect(f.canvas.width).toBe(320);
  expect(f.canvas.height).toBe(180);
  const foreign = document.createElement('div');
  expect(
    createLibraryLiquidMaterialSink(foreign, { queueStyle() {}, requestFlush() {} })
  ).toBeNull();
  harness.sourceEnabled(false);
  expect(harness.state().sourceRevision).toBeNull();
  harness.sourceEnabled(true);
  expect(harness.state().sourceRevision).toBeGreaterThan(1);
  expect(f.owner.querySelector('a')).toBe(f.link);
  expect(f.link.getAttribute('href')).toBe('/target');
  release();
  expect(() => harness.state()).toThrow('not-initialized');
  removeHarness();
});
it('fails the scene closed when the Canvas belongs to an intervening wrapper', () => {
  const f = fixture(false),
    release = initLibraryLiquidScenes(document);
  expect(f.owner.dataset.libraryLiquidState).toBe('unavailable');
  expect(f.owner.dataset.libraryLiquidError).toContain('ownership-invalid');
  expect(f.context.fillRect).not.toHaveBeenCalled();
  release();
});
it('keeps an opaque accessible candidate if Canvas acquisition fails, without stopping the other Gallery parts', () => {
  const f = fixture();
  vi.mocked(f.canvas.getContext).mockReturnValue(null);
  const release = initLibraryLiquidScenes(document);
  expect(f.owner.dataset.libraryLiquidState).toBe('unavailable');
  expect(f.owner.dataset.libraryLiquidError).toContain('2D context unavailable');
  expect(f.link.getAttribute('href')).toBe('/target');
  release();
});
it('does not remove a newer candidate harness when an earlier one retires', () => {
  const f = fixture(),
    release = initLibraryLiquidScenes(document);
  const old = installLibraryLiquidCandidateHarness(document);
  const newer = installLibraryLiquidCandidateHarness(document);
  const current = (window as any).libraryLiquidCardCandidate;
  old();
  expect((window as any).libraryLiquidCardCandidate).toBe(current);
  newer();
  expect((window as any).libraryLiquidCardCandidate).toBeUndefined();
  release();
});
