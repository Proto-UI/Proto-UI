import {
  createCanvasBackdropLease,
  createWebMaterialSink,
  createWebMaterialPreferences,
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
    mount = doc.createElement('div');
  scope.dataset.materialScene = 'visible-app-canvas';
  Object.assign(scope.style, {
    position: 'relative',
    isolation: 'isolate',
    width: '100%',
    minWidth: '0',
  });
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
  scope.append(canvas, mount);
  parent.append(scope);
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
  let lastSourceSignature = '';
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
  const resize = win.ResizeObserver ? new win.ResizeObserver(refresh) : null;
  resize?.observe(scope);
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
      resize?.disconnect();
      visibility?.disconnect();
      appearance.disconnect();
      offPreferences();
      resolution?.removeEventListener('change', resolutionChanged);
      scheme?.removeEventListener('change', refresh);
      doc.removeEventListener('visibilitychange', refresh);
      win.removeEventListener('resize', refresh);
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
