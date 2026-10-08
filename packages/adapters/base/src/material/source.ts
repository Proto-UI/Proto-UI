import { contactCarrierBounds } from './contact-carrier';
/** A bounded source is the visible application canvas itself. No DOM capture,
 * screenshot API, external image fetch, or self-output sampling is performed. */
export type CanvasBackdropFrame = Readonly<{
  revision: number;
  width: number;
  height: number;
  pixels: Uint8Array;
  canvas: HTMLCanvasElement;
  scope: HTMLElement;
}>;
export type CanvasBackdropLease = {
  current(): CanvasBackdropFrame | null;
  subscribe(invalidate: () => void): () => void;
  draw(paint: (context: CanvasRenderingContext2D, width: number, height: number) => void): void;
  revoke(): void;
  dispose(): void;
};
export function createCanvasBackdropLease(
  scope: HTMLElement,
  canvas: HTMLCanvasElement
): CanvasBackdropLease {
  if (canvas.ownerDocument !== scope.ownerDocument || canvas.parentElement !== scope)
    throw new Error('Backdrop canvas must belong directly to its scope');
  let revision = 0,
    disposed = false,
    frame: CanvasBackdropFrame | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    let failure: unknown;
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        failure ??= error;
      }
    }
    if (failure) throw failure;
  };
  return {
    current: () => frame,
    subscribe(fn) {
      if (disposed) throw new Error('Retired backdrop lease');
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    draw(paint) {
      if (disposed) throw new Error('Retired backdrop lease');
      const operation = ++revision;
      frame = null;
      try {
        const rect = canvas.getBoundingClientRect(),
          dpr = canvas.ownerDocument.defaultView?.devicePixelRatio ?? NaN;
        if (disposed || revision !== operation) return;
        const width = Math.ceil(rect.width * dpr),
          height = Math.ceil(rect.height * dpr);
        if (
          ![width, height, dpr].every(Number.isFinite) ||
          width < 1 ||
          height < 1 ||
          width > 2048 ||
          height > 2048 ||
          width * height > 1048576
        )
          return;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (disposed || revision !== operation) return;
        if (!context) throw new Error('Backdrop 2D context unavailable');
        canvas.width = width;
        canvas.height = height;
        paint(context, width, height);
        if (disposed || revision !== operation) return;
        const pixels = new Uint8Array(context.getImageData(0, 0, width, height).data);
        if (disposed || revision !== operation) return;
        for (let i = 3; i < pixels.length; i += 4)
          if (pixels[i] !== 255) throw new Error('Backdrop must be opaque');
        frame = Object.freeze({ revision: operation, width, height, pixels, canvas, scope });
      } finally {
        notify();
      }
    },
    revoke() {
      if (disposed) return;
      frame = null;
      revision++;
      notify();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      frame = null;
      revision++;
      try {
        notify();
      } finally {
        listeners.clear();
      }
    },
  };
}
const composedParent = (element: Element): Element | null => {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof element.ownerDocument.defaultView!.ShadowRoot ? root.host : null;
};
const transparent = (value: string) =>
  !value || value === 'transparent' || /^rgba\([^)]*,\s*0\)$/.test(value);
const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const neutral = (css: CSSStyleDeclaration) =>
  (!(css as any).zoom || ['normal', '1'].includes((css as any).zoom)) &&
  (!(css as any).contentVisibility || (css as any).contentVisibility === 'visible') &&
  (!css.opacity || Number(css.opacity) === 1) &&
  (!css.filter || css.filter === 'none') &&
  (!css.mixBlendMode || css.mixBlendMode === 'normal') &&
  (!css.clip || css.clip === 'auto') &&
  ['clipPath', 'maskImage', 'webkitMaskImage'].every(
    (key) => !(css as any)[key] || (css as any)[key] === 'none'
  ) &&
  ['transform', 'rotate', 'scale', 'translate'].every(
    (k) => !(css as any)[k] || (css as any)[k] === 'none'
  );
/** Conservative scene admission. Overlapping siblings and painted ancestors
 * are unavailable rather than silently omitted from an alleged DOM backdrop. */
export function inspectCanvasBackdrop(
  host: HTMLElement,
  frame: CanvasBackdropFrame | null,
  paintOutset = 0
) {
  const fail = (reason: string) => ({ valid: false as const, reason });
  if (
    !frame ||
    !host.isConnected ||
    !frame.scope.isConnected ||
    !frame.canvas.isConnected ||
    !frame.scope.contains(host) ||
    host === frame.scope ||
    host.ownerDocument !== frame.scope.ownerDocument ||
    frame.canvas.parentElement !== frame.scope
  )
    return fail('source-scope-unavailable');
  if (host.contains(frame.canvas)) return fail('source-includes-own-output');
  const win = host.ownerDocument.defaultView;
  if (!win) return fail('source-document-unavailable');
  const source = frame.canvas.getBoundingClientRect(),
    target = host.getBoundingClientRect();
  if (!Number.isFinite(paintOutset) || paintOutset < 0 || paintOutset > 165)
    return fail('source-paint-outset-unavailable');
  const paint = {
    left: target.left - paintOutset,
    top: target.top - paintOutset,
    right: target.right + paintOutset,
    bottom: target.bottom + paintOutset,
  } as DOMRect;
  if (
    source.width <= 0 ||
    source.height <= 0 ||
    target.width <= 0 ||
    target.height <= 0 ||
    paint.left < source.left ||
    paint.top < source.top ||
    paint.right > source.right ||
    paint.bottom > source.bottom
  )
    return fail('source-bounds-unavailable');
  const dpr = win.devicePixelRatio;
  if (
    Math.ceil(source.width * dpr) !== frame.width ||
    Math.ceil(source.height * dpr) !== frame.height ||
    frame.canvas.width !== frame.width ||
    frame.canvas.height !== frame.height
  )
    return fail('source-resize-or-dpr-stale');
  const canvasCss = win.getComputedStyle(frame.canvas);
  if (
    [
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
    ].some((name) => parseFloat((canvasCss as any)[name] || '0') !== 0)
  )
    return fail('source-canvas-insets-unavailable');
  if (canvasCss.display === 'none' || canvasCss.visibility === 'hidden' || !neutral(canvasCss))
    return fail('source-not-visible-or-composited');
  let current: Element | null = host;
  while (current) {
    const css = win.getComputedStyle(current);
    if (!neutral(css)) return fail('source-compositing-unavailable');
    if (css.visibility && css.visibility !== 'visible')
      return fail('source-not-visible-or-composited');
    if (
      paintOutset > 0 &&
      ([css.overflow, css.overflowX, css.overflowY].some((v) => v && v !== 'visible') ||
        /(?:paint|strict|content)/.test(css.contain))
    )
      return fail('source-expanded-paint-clipped');
    if (
      current !== host &&
      current !== frame.scope &&
      (!transparent(css.backgroundColor) || (css.backgroundImage && css.backgroundImage !== 'none'))
    )
      return fail('source-painted-ancestor');
    if (current === frame.scope) break;
    current = composedParent(current);
  }
  if (current !== frame.scope) return fail('source-cross-scope');
  for (
    let ancestor: Element | null = composedParent(frame.scope);
    ancestor;
    ancestor = composedParent(ancestor)
  ) {
    const css = win.getComputedStyle(ancestor);
    if (!neutral(css)) return fail('source-ancestor-compositing-unavailable');
    if (
      paintOutset > 0 &&
      ([css.overflow, css.overflowX, css.overflowY].some((v) => v && v !== 'visible') ||
        /(?:paint|strict|content)/.test(css.contain))
    )
      return fail('source-expanded-paint-clipped');
  }
  for (const element of frame.scope.querySelectorAll('*')) {
    if (
      element === frame.canvas ||
      element === host ||
      host.contains(element) ||
      element.contains(host)
    )
      continue;
    const css = win.getComputedStyle(element);
    if (css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity || '1') === 0)
      continue;
    if (overlaps(paint, contactCarrierBounds(element))) return fail('source-overlapping-content');
  }
  return {
    valid: true as const,
    reason: 'visible-app-canvas',
    bounds: [
      (target.left - source.left) / source.width,
      (target.top - source.top) / source.height,
      target.width / source.width,
      target.height / source.height,
    ] as [number, number, number, number],
  };
}
