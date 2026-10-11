import type { EffectsPort } from '@proto.ui/core';
import type { VisualFeedbackSink } from '@proto.ui/module-feedback';
import {
  createCanvasBackdropLease,
  createWebMaterialPreferences,
  createWebMaterialSink,
  type MaterialPaletteSnapshot,
} from '@proto.ui/adapter-base/web-material';
import { armExperimentalInitialPaintCapture } from '../../../../packages/adapters/base/src/material/initial-paint-experiment';
import { THEME } from '../../../../packages/prototypes/liquid-glass/src/theme';

export const LIQUID_CARD_CANDIDATE_TAG = 'wc-library-liquid-optical-surface';
const records = new WeakMap<HTMLElement, ReturnType<typeof createScene>>();
const providers = new WeakMap<HTMLElement, ReturnType<typeof createScene>>();
const scopes = new WeakMap<ParentNode, () => void>();
export type LibraryLiquidCandidateHarness = Pick<
  ReturnType<typeof createScene>,
  'beginCapture' | 'artifact' | 'state' | 'sourceEnabled'
>;
const familyIsDark = (owner: HTMLElement) => {
  for (let node: HTMLElement | null = owner; node; node = node.parentElement) {
    if (node.classList.contains('dark') || node.dataset.theme === 'dark') return true;
    if (node.classList.contains('light') || node.dataset.theme === 'light') return false;
  }
  return owner.ownerDocument.defaultView!.matchMedia('(prefers-color-scheme: dark)').matches;
};

/** The source is this visible Canvas, drawn from deterministic first-party
 * geometry. Gradients belong to the scene artwork, not a material substitute. */
export function drawLibraryLiquidBackdrop(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  dark: boolean
) {
  context.fillStyle = dark ? '#18243b' : '#e4ebf4';
  context.fillRect(0, 0, width, height);
  const shapes = dark ? ['#374d78', '#795b83', '#356974'] : ['#99bedf', '#ddadc5', '#97cfcc'];
  for (let index = 0; index < shapes.length; index++) {
    const x = width * [0.12, 0.62, 0.94][index];
    const y = height * [0.12, 0.8, 0.12][index];
    const gradient = context.createRadialGradient(x, y, 0, x, y, Math.max(width, height) * 0.55);
    gradient.addColorStop(0, shapes[index]);
    gradient.addColorStop(1, dark ? '#18243b00' : '#e4ebf400');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
  // Sharp edges make actual refraction observable without text/font inputs.
  context.strokeStyle = dark ? '#abc1dc' : '#fbfcff';
  context.lineWidth = Math.max(1, width / 240);
  for (let line = 0; line < 5; line++) {
    context.beginPath();
    context.moveTo(width * (0.08 + line * 0.2), 0);
    context.bezierCurveTo(
      width * (0.22 + line * 0.2),
      height * 0.32,
      width * (line * 0.2),
      height * 0.72,
      width * (0.16 + line * 0.2),
      height
    );
    context.stroke();
  }
}

function createScene(owner: HTMLElement) {
  const document = owner.ownerDocument,
    win = document.defaultView!;
  const canvas = owner.querySelector<HTMLCanvasElement>('canvas[data-library-liquid-canvas]');
  const target = owner.querySelector<HTMLElement>(
    `[data-library-liquid-optical] ${LIQUID_CARD_CANDIDATE_TAG}`
  );
  if (
    !canvas ||
    canvas.parentElement !== owner ||
    !target ||
    !target.closest('a[data-library-action]')
  )
    throw new Error('library-liquid-scene-ownership-invalid');
  const source = createCanvasBackdropLease(owner, canvas);
  const preferences = createWebMaterialPreferences(win);
  let dark = familyIsDark(owner),
    retired = false,
    available = true,
    signature = '';
  let palette: MaterialPaletteSnapshot = { revision: 1, colors: THEME[dark ? 'dark' : 'light'] };
  const paletteListeners = new Set<() => void>();
  const options = {
    source,
    preferences,
    palette: {
      current: () => palette,
      subscribe(callback: () => void) {
        paletteListeners.add(callback);
        return () => {
          paletteListeners.delete(callback);
        };
      },
    },
  };
  let capture: ReturnType<typeof armExperimentalInitialPaintCapture> | null = null;
  let captureSource: ReturnType<typeof source.current> = null;
  let captureMetadata: ReturnType<typeof metadata> | null = null;
  const stops: Array<() => void> = [];
  let scheduled: number | null = null;
  function metadata() {
    const rootStyle = win.getComputedStyle(document.documentElement),
      text = win.getComputedStyle(
        target!.querySelector('[data-library-part="liquid-glass-text"]') ?? target!
      );
    return {
      locale: document.documentElement.lang,
      viewport: { width: win.innerWidth, height: win.innerHeight },
      dpr: win.devicePixelRatio,
      theme: dark ? 'dark' : 'light',
      rootFontSize: rootStyle.fontSize,
      scene: owner.getBoundingClientRect().toJSON(),
      action: target!.getBoundingClientRect().toJSON(),
      font: { family: text.fontFamily, size: text.fontSize, lineHeight: text.lineHeight },
      tokens: target!.getAttribute('data-pui-style'),
      recipe: target!.dataset.libraryProps,
      sourceRevision: source.current()?.revision ?? null,
    };
  }
  function draw(force = false) {
    if (retired || !available || owner.ownerDocument !== document || !owner.isConnected) return;
    const nextDark = familyIsDark(owner);
    if (nextDark !== dark) {
      source.revoke();
      dark = nextDark;
      palette = { revision: palette.revision + 1, colors: THEME[dark ? 'dark' : 'light'] };
      for (const callback of [...paletteListeners]) callback();
    }
    const rect = canvas!.getBoundingClientRect();
    const next = JSON.stringify([rect.width, rect.height, win.devicePixelRatio, dark]);
    if (!force && next === signature && source.current()) return;
    signature = next;
    try {
      source.draw((context, width, height) =>
        drawLibraryLiquidBackdrop(context, width, height, dark)
      );
      owner.dataset.libraryLiquidState = source.current() ? 'source-ready' : 'unavailable';
      delete owner.dataset.libraryLiquidError;
    } catch (error) {
      owner.dataset.libraryLiquidState = 'unavailable';
      owner.dataset.libraryLiquidError = String(error);
      // Keep the ordinary Surface and native anchor functional when this
      // browser cannot acquire the owned Canvas. No optical receipt is issued.
    }
  }
  const schedule = () => {
    if (retired || scheduled !== null) return;
    scheduled = win.requestAnimationFrame(() => {
      scheduled = null;
      draw();
    });
  };
  const resize = win.ResizeObserver ? new win.ResizeObserver(schedule) : null;
  resize?.observe(owner);
  resize?.observe(target);
  stops.push(() => resize?.disconnect());
  const mutation = new win.MutationObserver(schedule);
  mutation.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style'],
  });
  stops.push(() => mutation.disconnect());
  win.addEventListener('resize', schedule);
  stops.push(() => win.removeEventListener('resize', schedule));
  try {
    draw();
  } catch (error) {
    retired = true;
    for (const stop of stops.splice(0)) {
      try {
        stop();
      } catch {
        /* keep acquisition failure */
      }
    }
    try {
      source.dispose();
    } catch {
      /* keep acquisition failure */
    }
    throw error;
  }
  const record = {
    owner,
    target,
    source,
    sink(host: HTMLElement, effects: EffectsPort) {
      return host === target ? createWebMaterialSink(host, effects, options) : null;
    },
    beginCapture() {
      if (retired) throw new Error('library-liquid-scene-retired');
      capture?.dispose();
      // Synchronize the actual scene/theme before fixing the producer profile.
      draw();
      const current = metadata();
      const id =
        `library-liquid-${current.locale.toLowerCase()}-${current.viewport.width}-${current.viewport.height}-${String(current.dpr).replace('.', 'p')}-${parseFloat(current.rootFontSize)}`.replace(
          /[^a-z0-9-]/g,
          '-'
        );
      capture = armExperimentalInitialPaintCapture(target!, {
        id,
        viewportWidth: win.innerWidth,
        viewportHeight: win.innerHeight,
        dpr: win.devicePixelRatio,
        theme: dark ? 'dark' : 'light',
      });
      draw(true);
      captureSource = source.current();
      captureMetadata = metadata();
      return captureMetadata;
    },
    async artifact() {
      if (!capture || retired) throw new Error('library-liquid-capture-unavailable');
      const active = capture,
        artifact = await active.artifact();
      if (
        retired ||
        capture !== active ||
        source.current() !== captureSource ||
        canvas!.toDataURL('image/png') !== artifact.receipt.source.pngDataUrl ||
        JSON.stringify(metadata().action) !== JSON.stringify(captureMetadata?.action)
      )
        throw new Error('library-liquid-capture-inputs-changed');
      return { ...artifact, card: captureMetadata };
    },
    state() {
      return {
        ...metadata(),
        quality: target!.dataset.materialQuality,
        reason: target!.dataset.materialReason,
        source: target!.dataset.materialSource,
        image: win.getComputedStyle(target!).backgroundImage,
        retired,
      };
    },
    sourceEnabled(value: boolean) {
      available = value;
      if (!value) {
        source.revoke();
        owner.dataset.libraryLiquidState = 'unavailable';
      } else draw(true);
    },
    dispose() {
      if (retired) return;
      retired = true;
      if (scheduled !== null) win.cancelAnimationFrame(scheduled);
      for (const stop of stops.splice(0)) stop();
      capture?.dispose();
      capture = null;
      source.dispose();
      paletteListeners.clear();
      if (providers.get(target!) === record) providers.delete(target!);
      if (records.get(owner) === record) records.delete(owner);
    },
  };
  providers.set(target, record);
  return record;
}

export function initLibraryLiquidScenes(scope: ParentNode = document) {
  if (scopes.has(scope)) return scopes.get(scope)!;
  const owned: ReturnType<typeof createScene>[] = [];
  for (const owner of scope.querySelectorAll<HTMLElement>('[data-library-liquid-scene]')) {
    try {
      const record = records.get(owner) ?? createScene(owner);
      records.set(owner, record);
      owned.push(record);
    } catch (error) {
      owner.dataset.libraryLiquidState = 'unavailable';
      owner.dataset.libraryLiquidError = String(error);
    }
  }
  const release = () => {
    for (const record of owned) record.dispose();
    scopes.delete(scope);
  };
  scopes.set(scope, release);
  return release;
}
export function createLibraryLiquidMaterialSink(
  host: HTMLElement,
  effects: EffectsPort
): VisualFeedbackSink | null {
  let record = providers.get(host);
  if (!record) {
    const owner = host.closest<HTMLElement>('[data-library-liquid-scene]');
    if (owner && !records.has(owner)) {
      record = createScene(owner);
      records.set(owner, record);
    }
  }
  return record?.sink(host, effects) ?? null;
}
/** Candidate-route harness only. It never exists on the default Library route. */
export function installLibraryLiquidCandidateHarness(scope: ParentNode = document) {
  const document =
    (scope as Node).nodeType === 9 ? (scope as Document) : (scope as Node).ownerDocument;
  const win = document!.defaultView!;
  const current = () => {
    const owner = scope.querySelector<HTMLElement>('[data-library-liquid-scene]');
    const record = owner && records.get(owner);
    if (!record) throw new Error('library-liquid-candidate-not-initialized');
    return record;
  };
  const harness = {
    beginCapture: () => current().beginCapture(),
    artifact: () => current().artifact(),
    state: () => current().state(),
    sourceEnabled: (value: boolean) => current().sourceEnabled(value),
  };
  (win as typeof win & { libraryLiquidCardCandidate?: typeof harness }).libraryLiquidCardCandidate =
    harness;
  return () => {
    const target = win as typeof win & { libraryLiquidCardCandidate?: typeof harness };
    if (target.libraryLiquidCardCandidate === harness) delete target.libraryLiquidCardCandidate;
  };
}
