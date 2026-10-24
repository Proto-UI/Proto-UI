import { registerWebPortalDestination } from '@proto.ui/adapter-base';
import {
  createCanvasBackdropLease,
  createWebMaterialSink,
  createWebMaterialPreferences,
  contactPaintOutset,
  type MaterialPaletteSnapshot,
} from '@proto.ui/adapter-base/web-material';
import { THEME } from '../../../../../packages/prototypes/liquid-glass/src/theme';
import { registerPreviewMaterialProvider } from './preview-material-provider';
/** This canvas is the visible preview background and the ONLY sampled plane.
 * Ordinary DOM is never captured. Intervening paint and cross-scope portals
 * deliberately lose optical admission rather than sampling invented pixels. */
export function createPreviewMaterialScene(parent: HTMLElement) {
  const doc = parent.ownerDocument,
    win = doc.defaultView!;
  const scope = doc.createElement('div'),
    canvas = doc.createElement('canvas'),
    mount = doc.createElement('div'),
    overlayMount = doc.createElement('div');
  scope.dataset.materialScene = 'visible-app-canvas';
  Object.assign(scope.style, {
    position: 'relative',
    isolation: 'isolate',
    width: '100%',
    minWidth: '0',
    // A finite, responsive application stage. Its height is actual flow/popup
    // extent below, not a hidden full-page capture surface. Enlarged fonts or
    // DPR may exceed the source budget; the unchanged lease then fails closed.
    maxWidth: '32rem',
    boxSizing: 'border-box',
    paddingBlock: '2rem',
    paddingInline: 'min(2rem, 8%)',
  });
  // This visible scene already owns preview padding and popup space. A nested
  // centered RuntimeBox reserve would leave real flow boxes behind the popup,
  // which cannot be omitted from the canvas source's foreground checks.
  scope.style.setProperty('--runtime-box-content-min', '0px');
  scope.style.setProperty('--runtime-box-content-padding', '0px');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.materialBackdrop = '';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '0',
  });
  Object.assign(mount.style, { position: 'relative', zIndex: '1', minWidth: '0', width: '100%' });
  // The extended plane is visibly painted application layout, not a hidden
  // sampling texture. Overlay content remains above this same real canvas.
  overlayMount.dataset.materialOverlayMount = '';
  Object.assign(overlayMount.style, { position: 'relative', zIndex: '2', height: '0' });
  scope.append(canvas, mount, overlayMount);
  parent.append(scope);
  const unregisterDestination = registerWebPortalDestination(scope, overlayMount);
  const lease = createCanvasBackdropLease(scope, canvas),
    preferences = createWebMaterialPreferences(win);
  let retired = false,
    paused = false,
    available = true,
    phase = 0,
    raf: number | null = null,
    previousTime = -Infinity,
    dark = false,
    intersecting = true;
  let layoutRaf: number | null = null;
  let lastSourceSignature = '';
  const observed = new Set<Element>();
  let palette: MaterialPaletteSnapshot = { revision: 0, colors: THEME.light };
  const paletteListeners = new Set<() => void>();
  const isDark = () => {
    for (let node: Element | null = parent; node; node = node.parentElement) {
      if (node.classList.contains('dark') || node.getAttribute('data-theme') === 'dark')
        return true;
      if (node.classList.contains('light') || node.getAttribute('data-theme') === 'light')
        return false;
    }
    return win.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
  };
  // Fixed/absolute portals do not contribute to CSS flow. Reserve their real
  // visible footprint in this application scene, including the maximum shared
  // contact paint envelope. This observer only measures; the Adapter exclusively
  // owns projection. Left/top overflow and over-budget scenes still fail the
  // ordinary source checks rather than moving controls or inventing pixels.
  function layout() {
    const scene = scope.getBoundingClientRect();
    const flow = mount.getBoundingClientRect();
    // Rectangles are viewport pixels; reserve and padding use local CSS pixels.
    const css = win.getComputedStyle(scope);
    const scale = scene.width / parseFloat(css.width);
    if (!Number.isFinite(scale) || scale <= 0) return;
    const padding = parseFloat(css.paddingBottom) || 0;
    let bottom = (flow.bottom - scene.top) / scale + padding;
    for (const element of overlayMount.querySelectorAll<HTMLElement>('*')) {
      if (element.closest('[data-material-scene]') !== scope) continue;
      const css = win.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        css.display === 'none' ||
        css.visibility === 'hidden' ||
        rect.width <= 0 ||
        rect.height <= 0
      )
        continue;
      bottom = Math.max(
        bottom,
        (rect.bottom - scene.top + contactPaintOutset(rect.width, rect.height)) / scale + padding
      );
    }
    const height = Math.max(0, Math.ceil(bottom));
    if (Number.isFinite(height) && scope.style.minHeight !== `${height}px`)
      scope.style.minHeight = `${height}px`;
  }
  function scheduleLayout() {
    if (retired || layoutRaf !== null) return;
    layoutRaf = win.requestAnimationFrame(() => {
      layoutRaf = null;
      if (retired) return;
      layout();
      refresh();
    });
  }
  function draw(force = false) {
    if (retired || !available) return;
    const nextDark = isDark();
    if (nextDark !== dark || palette.revision === 0) {
      lease.revoke();
      dark = nextDark;
      palette = Object.freeze({
        revision: palette.revision + 1,
        colors: dark ? THEME.dark : THEME.light,
      });
      for (const listener of [...paletteListeners]) listener();
    }
    const rect = canvas.getBoundingClientRect();
    const signature = JSON.stringify([rect.width, rect.height, win.devicePixelRatio, dark, phase]);
    if (!force && signature === lastSourceSignature && lease.current()) return;
    lastSourceSignature = signature;
    lease.draw((ctx, width, height) => {
      ctx.fillStyle = dark ? '#182238' : '#e9eef8';
      ctx.fillRect(0, 0, width, height);
      const colors = dark ? ['#243b58', '#254b4c', '#493654'] : ['#a9c9f4', '#c9dfe8', '#f0bdca'];
      for (let i = -2; i < 18; i++) {
        ctx.fillStyle = colors[(i + 3) % colors.length];
        ctx.beginPath();
        ctx.moveTo((i * width) / 12 + phase, 0);
        ctx.lineTo(((i + 1) * width) / 12 + phase, 0);
        ctx.lineTo(((i + 1) * width) / 12 - height / 3 + phase, height);
        ctx.lineTo((i * width) / 12 - height / 3 + phase, height);
        ctx.fill();
      }
      ctx.fillStyle = dark ? '#59728d' : '#7386aa';
      ctx.font = `${Math.max(10, Math.round(12 * win.devicePixelRatio))}px system-ui`;
      for (let y = 25 * win.devicePixelRatio; y < height; y += 44 * win.devicePixelRatio)
        ctx.fillText(
          'PROTO UI  ·  VISIBLE APP BACKDROP  ·  LIVE CANVAS',
          15 * win.devicePixelRatio + phase / 3,
          y
        );
    });
  }
  function animate() {
    return (
      !retired &&
      available &&
      !paused &&
      intersecting &&
      doc.visibilityState !== 'hidden' &&
      preferences.current().reducedMotion === 'no-preference' &&
      scope.getBoundingClientRect().height > 0 &&
      win.getComputedStyle(scope).visibility !== 'hidden'
    );
  }
  function refresh() {
    if (retired) return;
    draw();
    if (animate()) {
      if (raf === null) raf = win.requestAnimationFrame(tick);
    } else if (raf !== null) {
      win.cancelAnimationFrame(raf);
      raf = null;
    }
  }
  function tick(time: number) {
    raf = null;
    if (!animate()) return;
    if (time - previousTime >= 120) {
      previousTime = time;
      phase = (phase + 1.5 * win.devicePixelRatio) % 80;
      draw();
    }
    if (animate()) raf = win.requestAnimationFrame(tick);
  }
  const unregister = registerPreviewMaterialProvider(scope, (host, effects) =>
    createWebMaterialSink(host, effects, {
      source: lease,
      preferences,
      palette: {
        current: () => palette,
        subscribe(fn) {
          paletteListeners.add(fn);
          return () => {
            paletteListeners.delete(fn);
          };
        },
      },
    })
  );
  const resize = win.ResizeObserver ? new win.ResizeObserver(scheduleLayout) : null;
  resize?.observe(scope);
  resize?.observe(mount);
  // Subscribe to newly projected sizes and retire removed targets. Attribute
  // changes also cover placement updates, including an unchanged popup size.
  const overlayChanges = new win.MutationObserver(() => {
    const current = new Set(overlayMount.querySelectorAll('*'));
    for (const element of observed) {
      if (current.has(element)) continue;
      resize?.unobserve(element);
      observed.delete(element);
    }
    for (const element of current) {
      if (observed.has(element)) continue;
      observed.add(element);
      resize?.observe(element);
    }
    scheduleLayout();
  });
  overlayChanges.observe(overlayMount, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden'],
  });
  const visibility = win.IntersectionObserver
    ? new win.IntersectionObserver((entries) => {
        intersecting = entries.at(-1)?.isIntersecting ?? false;
        refresh();
      })
    : null;
  visibility?.observe(scope);
  const appearance = new win.MutationObserver(refresh);
  for (let node: Element | null = parent; node; node = node.parentElement)
    appearance.observe(node, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'hidden', 'style'],
    });
  let resolution: MediaQueryList | undefined;
  const resolutionChanged = () => {
    resolution?.removeEventListener('change', resolutionChanged);
    resolution = win.matchMedia?.(`(resolution: ${win.devicePixelRatio}dppx)`);
    resolution?.addEventListener('change', resolutionChanged);
    layout();
    refresh();
  };
  resolutionChanged();
  const scheme = win.matchMedia?.('(prefers-color-scheme: dark)');
  scheme?.addEventListener('change', refresh);
  const offPreferences = preferences.subscribe(refresh);
  doc.addEventListener('visibilitychange', refresh);
  win.addEventListener('resize', refresh);
  refresh();
  return {
    mount,
    scope,
    overlayMount,
    lease,
    pause(value: boolean) {
      paused = value;
      refresh();
    },
    sourceAvailable(value: boolean) {
      available = value;
      if (value) draw(true);
      else lease.revoke();
      refresh();
    },
    redraw() {
      draw(true);
    },
    dispose() {
      if (retired) return;
      retired = true;
      if (raf !== null) win.cancelAnimationFrame(raf);
      if (layoutRaf !== null) win.cancelAnimationFrame(layoutRaf);
      overlayChanges.disconnect();
      observed.clear();
      resize?.disconnect();
      visibility?.disconnect();
      appearance.disconnect();
      offPreferences();
      resolution?.removeEventListener('change', resolutionChanged);
      scheme?.removeEventListener('change', refresh);
      doc.removeEventListener('visibilitychange', refresh);
      win.removeEventListener('resize', refresh);
      unregisterDestination();
      unregister();
      try {
        lease.dispose();
      } finally {
        paletteListeners.clear();
        scope.remove();
      }
    },
  };
}
