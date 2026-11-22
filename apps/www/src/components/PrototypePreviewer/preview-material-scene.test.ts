import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EffectsPort } from '@proto.ui/core';
import { resolveWebPortalDestination } from '@proto.ui/adapter-base';
import { inspectCanvasBackdrop } from '@proto.ui/adapter-base/web-material';
import * as webMaterial from '@proto.ui/adapter-base/web-material';
import { createPreviewMaterialScene, attachPreviewMaterialScene } from './preview-material-scene';
import { findPreviewMaterialProvider } from './preview-material-provider';
import { THEME } from '../../../../../packages/prototypes/liquid-glass/src/theme';

// Deterministic layout/source-lease evidence only. Pixels and layout below are
// stubs, never native optical evidence; the dedicated browser suite owns that.
const cleanups: Array<() => void> = [];
let width = 420;
let flowHeight = 40;
let layoutScale = 1;
let originX = 0;
let originY = 0;
let frames: Map<number, FrameRequestCallback>;
let resizeCallbacks: ResizeObserverCallback[];
let rects: WeakMap<Element, DOMRect>;
let paintedLabels: string[];
const rect = (x: number, y: number, w: number, h: number) => new DOMRect(x, y, w, h);
const viewportRect = (x: number, y: number, w: number, h: number) =>
  rect(originX + x * layoutScale, originY + y * layoutScale, w * layoutScale, h * layoutScale);
beforeEach(() => {
  width = 420;
  flowHeight = 40;
  layoutScale = 1;
  originX = 0;
  originY = 0;
  frames = new Map();
  resizeCallbacks = [];
  rects = new WeakMap();
  paintedLabels = [];
  let id = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
    frames.set(++id, fn);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(fn: ResizeObserverCallback) {
        resizeCallbacks.push(fn);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(1);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (rects.has(this)) return rects.get(this)!;
    const element = this as HTMLElement;
    const scope = element.closest<HTMLElement>('[data-material-scene]');
    if (element === scope || element.matches('[data-material-backdrop]'))
      return viewportRect(0, 0, width, parseFloat(scope!.style.minHeight) || flowHeight + 64);
    if (element.parentElement === scope && !element.matches('[data-material-overlay-mount]'))
      return viewportRect(32, 32, width - 64, flowHeight);
    return rect(0, 0, 0, 0);
  });
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const css = computed(element, pseudo);
    if (element.matches('[data-material-scene]')) {
      Object.defineProperty(css, 'paddingBottom', { value: '32px', configurable: true });
      Object.defineProperty(css, 'width', { value: `${width}px`, configurable: true });
    }
    return css;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    return {
      fillRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      fill() {},
      fillText(text: string) {
        paintedLabels.push(text);
      },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      bezierCurveTo() {},
      closePath() {},
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4).fill(255),
      }),
    } as any;
  });
});

afterEach(() => {
  for (const fn of cleanups.splice(0).reverse()) fn();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function scene(parent = document.body) {
  const scene = createPreviewMaterialScene(parent);
  scene.pause(true);
  cleanups.push(() => scene.dispose());
  return scene;
}
function resize() {
  for (const fn of resizeCallbacks) fn([], {} as ResizeObserver);
  for (const [id, fn] of [...frames]) {
    frames.delete(id);
    fn(0);
  }
}
describe('bounded visible Previewer source layout', () => {
  it('owns scene spacing without a second centered preview reserve or outside overrides', () => {
    const parent = document.createElement('div');
    parent.style.setProperty('--runtime-box-content-min', '10rem');
    parent.style.setProperty('--runtime-box-content-padding', '1.5rem 1rem');
    document.body.append(parent);
    const outside = document.createElement('div');
    parent.append(outside);
    const s = scene(parent);
    // The scene writes the logical padding properties by their CSSOM names.
    expect(s.scope.style.getPropertyValue('padding-block')).toBe('2rem');
    expect(s.scope.style.getPropertyValue('padding-inline')).toBe('min(2rem, 8%)');
    expect(s.scope.style.getPropertyValue('--runtime-box-content-min')).toBe('0px');
    expect(s.scope.style.getPropertyValue('--runtime-box-content-padding')).toBe('0px');
    expect(parent.style.getPropertyValue('--runtime-box-content-min')).toBe('10rem');
    expect(parent.style.getPropertyValue('--runtime-box-content-padding')).toBe('1.5rem 1rem');
    expect(outside.style.cssText).toBe('');
    expect(s.mount.style.display).not.toBe('contents');
    expect(s.mount.style.opacity).not.toBe('0');
  });

  it('registers the real scope and preserves nested projected author ancestry', () => {
    const s = scene();
    const origin = document.createElement('span');
    const content = document.createElement('div');
    s.mount.append(origin);
    expect(resolveWebPortalDestination(origin, content)).toBe(s.overlayMount);
    s.overlayMount.append(content);
    const nestedOrigin = document.createElement('span');
    content.append(nestedOrigin);
    const nestedTarget = document.createElement('div');
    expect(resolveWebPortalDestination(nestedOrigin, nestedTarget)).toBe(s.overlayMount);
    expect(findPreviewMaterialProvider(content)).not.toBeNull();
    const sibling = document.createElement('div');
    document.body.append(sibling);
    expect(resolveWebPortalDestination(sibling, nestedTarget)).toBe(document.body);
    s.dispose();
    expect(resolveWebPortalDestination(origin, content)).toBe(document.body);
    expect(s.lease.current()).toBeNull();
  });
  it('uses actual flow extent, then reserves and removes popup plus full contact envelope', () => {
    const s = scene();
    expect(s.scope.style.maxWidth).toBe('32rem');
    expect(s.scope.style.minHeight).toBe('104px');
    const popup = document.createElement('div');
    s.overlayMount.append(popup);
    rects.set(popup, rect(32, 80, 200, 300));
    resize();
    // 80 + 300 + ceil(300 * .08 + 1) + 32.
    expect(s.scope.style.minHeight).toBe('437px');
    expect(s.lease.current()?.height).toBe(437);
    expect(popup.parentElement).toBe(s.overlayMount);
    popup.remove();
    resize();
    expect(s.scope.style.minHeight).toBe('104px');
    expect(s.lease.current()?.height).toBe(104);
  });
  it.each([
    { scale: 1.25, popupReserve: 437 },
    { scale: 0.8, popupReserve: 439 },
  ])('keeps the CSS reserve in local units under zoom $scale', (zoom) => {
    // These are explicit scaled geometry facts, not native zoom/optical evidence.
    layoutScale = zoom.scale;
    originX = 37.25;
    originY = 91.5;
    const parent = document.createElement('div');
    parent.style.zoom = String(zoom.scale);
    document.body.append(parent);
    const s = scene(parent);
    expect(s.scope.style.minHeight).toBe('104px');
    const popup = document.createElement('div');
    s.overlayMount.append(popup);
    rects.set(popup, viewportRect(32, 80, 200, 300));
    resize();
    expect(s.scope.style.minHeight).toBe(`${zoom.popupReserve}px`);
    expect(popup.parentElement).toBe(s.overlayMount);
    popup.remove();
    resize();
    expect(s.scope.style.minHeight).toBe('104px');
  });

  it('rejects actual one-pixel coverage loss without weakening contains or outset checks', () => {
    const s = scene();
    const popup = document.createElement('div');
    s.overlayMount.append(popup);
    rects.set(popup, rect(32, 100, 200, 300));
    resize();
    const canvas = s.scope.querySelector('canvas')!;
    // Remove only the test layout reserve; source admission still sees the real
    // current canvas geometry, including the caller-specified full paintOutset.
    rects.set(canvas, rect(0, 0, 420, 424));
    s.redraw();
    expect(inspectCanvasBackdrop(popup, s.lease.current(), 25).reason).toBe(
      'source-bounds-unavailable'
    );
    rects.set(canvas, rect(0, 0, 420, 425));
    s.redraw();
    expect(inspectCanvasBackdrop(popup, s.lease.current(), 25).reason).toBe('visible-app-canvas');
    document.body.append(popup);
    expect(inspectCanvasBackdrop(popup, s.lease.current()).reason).toBe('source-scope-unavailable');
  });
  it('retains exact DPR and pixel budget boundaries rather than silently downsampling', () => {
    const s = scene();
    width = 512;
    flowHeight = 448;
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
    resize();
    expect(s.lease.current()).toMatchObject({ width: 1024, height: 1024 });
    flowHeight = 448.5;
    resize();
    expect(s.lease.current()).toBeNull();
    flowHeight = 448;
    resize();
    expect(s.lease.current()?.width).toBe(1024);
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3);
    s.redraw();
    expect(s.lease.current()).toBeNull();
  });
  it('refreshes a paused source from physical-pixel resize without a CSS resize or media callback', () => {
    const registrations: Array<{
      callback: ResizeObserverCallback;
      target: Element;
      options?: ResizeObserverOptions;
    }> = [];
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe(target: Element, options?: ResizeObserverOptions) {
          registrations.push({ callback: this.callback, target, options });
        }
        unobserve() {}
        disconnect = disconnect;
      }
    );
    const s = scene();
    const canvas = s.scope.querySelector('canvas')!;
    const original = s.lease.current()!;
    expect(original.width).toBe(420);
    const pixelObserver = registrations.find(
      (entry) => entry.target === canvas && entry.options?.box === 'device-pixel-content-box'
    );
    expect(pixelObserver).toBeDefined();
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
    // Only the physical pixel box changes; CSS geometry stays 420 x 104.
    pixelObserver!.callback([], {} as ResizeObserver);
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback(0);
    }
    expect(s.lease.current()).toMatchObject({ width: 840, height: 208 });
    expect(s.lease.current()!.revision).toBeGreaterThan(original.revision);
    s.dispose();
    pixelObserver!.callback([], {} as ResizeObserver);
    expect(frames.size).toBe(0);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(s.lease.current()).toBeNull();
  });
  it('rejects fractional edge overflow and non-finite DPR without fabricating a smaller source', () => {
    const s = scene();
    width = 2048;
    flowHeight = 1;
    resize();
    expect(s.lease.current()).toMatchObject({ width: 2048, height: 65 });
    width = 2048.01;
    resize();
    expect(s.lease.current()).toBeNull();
    width = 400;
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(Number.NaN);
    s.redraw();
    expect(s.lease.current()).toBeNull();
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(1.25);
    resize();
    expect(s.lease.current()).toMatchObject({ width: 500, height: 82 });
  });
  it('invalidates source withdrawal and cancels scheduled layout on disposal', () => {
    const s = scene();
    expect(s.lease.current()).not.toBeNull();
    s.sourceAvailable(false);
    expect(s.lease.current()).toBeNull();
    s.sourceAvailable(true);
    expect(s.lease.current()).not.toBeNull();
    for (const fn of resizeCallbacks) fn([], {} as ResizeObserver);
    expect(frames.size).toBeGreaterThan(0);
    s.dispose();
    expect(frames.size).toBe(0);
    expect(s.scope.isConnected).toBe(false);
  });
});

describe('framework-owned static stage attachments', () => {
  function boxes() {
    const scope = document.createElement('div'),
      mount = document.createElement('div'),
      overlay = document.createElement('div');
    const button = document.createElement('button');
    button.textContent = 'Real framework child';
    mount.append(button);
    scope.append(mount, overlay);
    document.body.append(scope);
    return { scope, mount, overlay, button };
  }
  it('keeps borrowed box/child identity and restores only styles it still owns', () => {
    const { scope, mount, overlay, button } = boxes();
    scope.style.position = 'sticky';
    const instance = attachPreviewMaterialScene(scope, mount, overlay);
    cleanups.push(() => instance.dispose());
    expect(scope.querySelectorAll('canvas[data-material-backdrop]')).toHaveLength(1);
    expect(findPreviewMaterialProvider(button)).not.toBeNull();
    const popup = document.createElement('div');
    expect(resolveWebPortalDestination(button, popup)).toBe(overlay);
    // Later framework owner, not ours to reset. Write it as a real CSS
    // declaration so the scene's own snapshot and restore can observe it.
    scope.style.setProperty('padding-inline', '7px');
    instance.dispose();
    instance.dispose();
    expect(scope.isConnected).toBe(true);
    expect(mount.firstChild).toBe(button);
    expect(scope.children).toHaveLength(2);
    expect(scope.style.position).toBe('sticky');
    expect(scope.style.getPropertyValue('padding-inline')).toBe('7px');
    expect(scope.hasAttribute('data-material-scene')).toBe(false);
    expect(findPreviewMaterialProvider(button)).toBeNull();
    expect(resolveWebPortalDestination(button, popup)).toBe(document.body);
    expect(frames.size).toBe(0);
  });
  it('rejects duplicate attachment without disturbing the first owner', () => {
    const { scope, mount, overlay, button } = boxes();
    const instance = attachPreviewMaterialScene(scope, mount, overlay);
    cleanups.push(() => instance.dispose());
    const provider = findPreviewMaterialProvider(button);
    expect(() => attachPreviewMaterialScene(scope, mount, overlay)).toThrow();
    expect(findPreviewMaterialProvider(button)).toBe(provider);
    expect(scope.querySelectorAll('canvas[data-material-backdrop]')).toHaveLength(1);
  });
  it('rejects an existing ancestor provider before creating a nested source', () => {
    const outer = scene();
    const { scope, mount, overlay, button } = boxes();
    outer.mount.append(scope);
    const provider = findPreviewMaterialProvider(button),
      oldMarkup = scope.outerHTML;
    expect(() => attachPreviewMaterialScene(scope, mount, overlay)).toThrow();
    expect(scope.outerHTML).toBe(oldMarkup);
    expect(findPreviewMaterialProvider(button)).toBe(provider);
  });
  it('rolls back canvas, destination, styles and provider after observer construction throws', () => {
    const { scope, mount, overlay, button } = boxes();
    const before = scope.outerHTML;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor() {
          throw undefined;
        }
      }
    );
    let failure: unknown = 'not thrown';
    try {
      attachPreviewMaterialScene(scope, mount, overlay);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeUndefined();
    expect(resolveWebPortalDestination(button, document.createElement('div'))).toBe(document.body);
    expect(scope.outerHTML).toBe(before);
    expect(findPreviewMaterialProvider(button)).toBeNull();
    expect(frames.size).toBe(0);
  });
});

describe('public material scene presentation', () => {
  let reducedMotion: boolean;
  let systemDark: boolean;
  let media: Map<string, EventTarget>;
  let intersection: IntersectionObserverCallback;
  beforeEach(() => {
    reducedMotion = false;
    systemDark = false;
    media = new Map();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      if (!media.has(query)) {
        const target = new EventTarget();
        Object.defineProperties(target, {
          media: { value: query },
          matches: {
            get: () => {
              if (query === '(prefers-reduced-motion: no-preference)') return !reducedMotion;
              if (query === '(prefers-reduced-motion: reduce)') return reducedMotion;
              if (query === '(prefers-color-scheme: dark)') return systemDark;
              return /: no-preference\)|forced-colors: none\)|resolution:/.test(query);
            },
          },
        });
        media.set(query, target);
      }
      return media.get(query) as MediaQueryList;
    });
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersection = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
  });

  function preview() {
    const s = createPreviewMaterialScene(document.body, { presentation: 'preview' });
    cleanups.push(() => s.dispose());
    return s;
  }
  function frame(time: number) {
    for (const [id, fn] of [...frames]) {
      frames.delete(id);
      fn(time);
    }
  }

  it('paints a quiet background once, retaining real source pixels without an idle RAF', () => {
    const s = preview();
    const initial = s.lease.current();
    expect(initial).not.toBeNull();
    expect(paintedLabels).toEqual([]);
    expect(frames.size).toBe(0);
    frame(1000);
    expect(s.lease.current() === initial).toBe(true);
    width = 460;
    resize();
    expect(s.lease.current()?.width).toBe(460);
    expect(s.lease.current()?.revision).toBeGreaterThan(initial!.revision);
    expect(frames.size).toBe(0);
  });

  it.each(['class', 'data-theme'])(
    'keeps the source and consumer palette aligned with the nearest %s theme',
    async (attribute) => {
      const parent = document.createElement('div');
      parent.setAttribute(attribute, 'light');
      document.body.append(parent);
      const s = createPreviewMaterialScene(parent, { presentation: 'preview' });
      cleanups.push(() => s.dispose());

      // Inspect the actual palette supplied to consumers, without instantiating
      // a GPU sink or interpreting these controlled pixels as visual evidence.
      const createSink = vi
        .spyOn(webMaterial, 'createWebMaterialSink')
        .mockReturnValue({ commit() {}, release() {} });
      const host = document.createElement('button');
      s.mount.append(host);
      findPreviewMaterialProvider(host)!(host, {
        queueStyle() {},
        requestFlush() {},
      } as EffectsPort);
      const palette = createSink.mock.calls[0][2].palette;
      const invalidate = vi.fn();
      cleanups.push(palette.subscribe(invalidate));
      expect(palette.current().colors).toEqual(THEME.light);

      async function theme(element: HTMLElement, value: 'light' | 'dark' | null) {
        // Await real observer delivery. No scene.redraw/refresh call may hide
        // a missing observation or a disagreement about the theme owner.
        await new Promise<void>((resolve) => {
          const delivery = new MutationObserver(() => {
            delivery.disconnect();
            resolve();
          });
          delivery.observe(element, { attributes: true, attributeFilter: [attribute] });
          if (value === null) element.removeAttribute(attribute);
          else element.setAttribute(attribute, value);
        });
      }

      const initialSource = s.lease.current()!;
      await theme(s.scope, 'dark');
      expect(palette.current().colors).toEqual(THEME.dark);
      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(s.lease.current()!.revision).toBeGreaterThan(initialSource.revision);

      await theme(parent, 'dark');
      const inheritedDarkSource = s.lease.current()!;
      await theme(s.scope, 'light');
      expect(palette.current().colors).toEqual(THEME.light);
      expect(s.lease.current()!.revision).toBeGreaterThan(inheritedDarkSource.revision);

      await theme(s.scope, null);
      expect(palette.current().colors).toEqual(THEME.dark);
      await theme(parent, null);
      expect(palette.current().colors).toEqual(THEME.light);
      systemDark = true;
      media.get('(prefers-color-scheme: dark)')!.dispatchEvent(new Event('change'));
      expect(palette.current().colors).toEqual(THEME.dark);
      expect(frames.size).toBe(0);
    }
  );

  it('retains the historical diagnostic pattern and cadence for unchanged optical fixtures', () => {
    const s = createPreviewMaterialScene(document.body);
    cleanups.push(() => s.dispose());
    expect(paintedLabels.some((text) => text.includes('VISIBLE APP BACKDROP'))).toBe(true);
    frame(0);
    const initial = s.lease.current();
    frame(8.33);
    expect(s.lease.current() === initial).toBe(true);
    frame(120);
    expect(s.lease.current()?.revision).toBeGreaterThan(initial!.revision);
    s.pause(true);
    expect(frames.size).toBe(0);
  });

  it('explicit dynamic preview updates at supplied frame times and stops on pause', () => {
    const s = preview();
    const initial = s.lease.current()!.revision;
    s.pause(false);
    expect(frames.size).toBe(1);
    frame(0);
    frame(8.33);
    const next = s.lease.current()!.revision;
    expect(next).toBeGreaterThan(initial);
    frame(16.66);
    expect(s.lease.current()!.revision).toBeGreaterThan(next);
    expect(frames.size).toBe(1);
    s.pause(true);
    const paused = s.lease.current();
    expect(frames.size).toBe(0);
    frame(1000);
    expect(s.lease.current() === paused).toBe(true);
  });

  it('observes owned-scope visibility changes and resumes without replaying hidden time', async () => {
    const s = preview();
    s.pause(false);
    frame(0);
    frame(8.33);
    const frozen = s.lease.current();
    expect(frames.size).toBe(1);

    // Keep MutationObserver delivery real: only canvas pixels, layout and the
    // frame clock are stubs. The observer registered by the scene must see
    // this same authored scope mutation without an injected refresh callback.
    async function visibility(value: string) {
      await new Promise<void>((resolve) => {
        const delivery = new MutationObserver(() => {
          delivery.disconnect();
          resolve();
        });
        delivery.observe(s.scope, { attributes: true, attributeFilter: ['style'] });
        s.scope.style.visibility = value;
      });
    }

    await visibility('hidden');
    expect(frames.size).toBe(0);
    frame(1000);
    expect(s.lease.current() === frozen).toBe(true);
    await visibility('visible');
    expect(frames.size).toBe(1);
    frame(2000);
    expect(s.lease.current() === frozen).toBe(true);
    frame(2008.33);
    expect(s.lease.current()!.revision).toBeGreaterThan(frozen!.revision);
    s.dispose();
    expect(frames.size).toBe(0);
  });

  it('cancels dynamic work when reduced, hidden or offscreen and resumes without catch-up', () => {
    const s = preview();
    s.pause(false);
    frame(0);
    frame(8.33);
    const frozen = s.lease.current();
    reducedMotion = true;
    media.get('(prefers-reduced-motion: reduce)')!.dispatchEvent(new Event('change'));
    expect(frames.size).toBe(0);
    frame(1000);
    expect(s.lease.current() === frozen).toBe(true);
    reducedMotion = false;
    media.get('(prefers-reduced-motion: reduce)')!.dispatchEvent(new Event('change'));
    expect(frames.size).toBe(1);
    frame(2000);
    expect(s.lease.current() === frozen).toBe(true);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(1);
    intersection(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    expect(frames.size).toBe(0);
    s.redraw();
    expect(s.lease.current() === frozen).toBe(true);
    intersection(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    expect(frames.size).toBe(1);
    s.dispose();
    expect(frames.size).toBe(0);
  });
});
