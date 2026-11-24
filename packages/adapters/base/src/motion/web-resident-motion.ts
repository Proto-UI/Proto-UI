import { createWebMotionStyleOwnership, webMotionAncestors } from './web-motion-style-ownership';
import type { EffectsPort, ResidentMotionProperty } from '@proto.ui/core';
import {
  createResidentMotionProjector,
  type ResidentMotionSink,
  type MotionRgba,
} from '@proto.ui/module-feedback';
import {
  createDefaultWebPreferenceSource,
  readWebPreference,
} from '../platform/web-preference-source';
export type ResidentMotionPaletteSource = {
  current(): Readonly<{
    revision: number;
    colors: Readonly<Record<string, MotionRgba>>;
    diagnostics?: readonly string[];
  }>;
  subscribe(invalidate: () => void): () => void;
};
/** Host environment input, not a component-specific styling escape hatch. */
export type WebResidentMotionOptions = {
  /** Fresh source per physical surface. Its subscribe cleanup is owned by that view. */
  palette?: ResidentMotionPaletteSource | ((surface: HTMLElement) => ResidentMotionPaletteSource);
  diagnostics?: (reasons: readonly string[]) => void;
};
/** One physical surface; replacement gets a fresh lease. No semantic DOM reads. */
export function createWebResidentMotionSink(
  el: HTMLElement,
  effects: EffectsPort,
  options: WebResidentMotionOptions = {}
): ResidentMotionSink {
  const paletteSource =
    typeof options.palette === 'function' ? options.palette(el) : options.palette;
  const doc = el.ownerDocument,
    win = doc.defaultView;
  let width: number | null = null,
    height: number | null = null;
  const { lost, detectLoss, clear, write } = createWebMotionStyleOwnership(el);
  const sink = createResidentMotionProjector({
    diagnostics: options.diagnostics,
    now: () => win?.performance.now() ?? 0,
    environment: () => {
      detectLoss();
      const preference = readWebPreference(doc, 'preference.reducedMotion');
      const palette = paletteSource?.current();
      // Root font is a host unit basis, never a recovered style target.
      const font = win
        ? Number.parseFloat(win.getComputedStyle(doc.documentElement).fontSize)
        : NaN;
      const hidden = webMotionAncestors(el).some((node) =>
        node.matches('[hidden],[data-pui-view-pending],[data-pui-view-detached]')
      );
      return {
        preference:
          preference === 'reduce' || preference === 'no-preference' ? preference : 'unknown',
        visible: el.isConnected && !hidden && doc.visibilityState !== 'hidden',
        supportedProperties: (
          (win?.CSS?.supports?.('translate', '1px')
            ? ['translate', 'background-color']
            : ['background-color']) as ResidentMotionProperty[]
        ).filter((property) => !lost.has(property)),
        projectionDiagnostics: [...lost].map((property) => `${property}:external-inline-owner`),
        width,
        height,
        rootFontPx: Number.isFinite(font) ? font : null,
        palette: palette?.colors ?? {},
        paletteRevision: palette?.revision ?? 0,
        paletteDiagnostics: palette?.diagnostics ?? [],
      };
    },
    subscribe(invalidate) {
      const getter = (key: string) => readWebPreference(doc, key);
      const preference = createDefaultWebPreferenceSource(getter, doc)?.subscribe(
        ['preference.reducedMotion'],
        invalidate
      );
      const offPalette = paletteSource?.subscribe(invalidate);
      // ResizeObserver borderBoxSize supplies layout-space (not transformed viewport) units.
      const resize =
        typeof win?.ResizeObserver === 'function'
          ? new win.ResizeObserver((entries) => {
              const entry = entries.find((e) => e.target === el);
              const box = entry?.borderBoxSize?.[0];
              const vertical = win.getComputedStyle(el).writingMode.startsWith('vertical');
              const physicalWidth = box ? (vertical ? box.blockSize : box.inlineSize) : null;
              const physicalHeight = box ? (vertical ? box.inlineSize : box.blockSize) : null;
              width =
                physicalWidth !== null && Number.isFinite(physicalWidth) ? physicalWidth : null;
              height =
                physicalHeight !== null && Number.isFinite(physicalHeight) ? physicalHeight : null;
              invalidate();
            })
          : null;
      resize?.observe(el, { box: 'border-box' });
      const observer =
        typeof win?.MutationObserver === 'function' ? new win.MutationObserver(invalidate) : null;
      for (const node of webMotionAncestors(el))
        observer?.observe(node, {
          attributes: true,
          attributeFilter: ['hidden', 'data-pui-view-pending', 'data-pui-view-detached'],
        });
      doc.addEventListener('visibilitychange', invalidate);
      return () => {
        preference?.();
        offPalette?.();
        resize?.disconnect();
        observer?.disconnect();
        doc.removeEventListener('visibilitychange', invalidate);
        clear();
      };
    },
    requestFrame: (callback) => win?.requestAnimationFrame(callback) ?? null,
    cancelFrame: (ticket) => {
      if (typeof ticket === 'number') win?.cancelAnimationFrame(ticket);
    },
    project(style, presentation, isCurrent) {
      if (!isCurrent()) return [];
      effects.queueStyle(style);
      if (!isCurrent()) return [];
      effects.requestFlush();
      if (!isCurrent()) return [];
      const accepted: ResidentMotionProperty[] = [];
      if (
        write(
          'translate',
          presentation.translate
            ? `${presentation.translate[0]}px ${presentation.translate[1]}px`
            : undefined
        )
      )
        accepted.push('translate');
      if (!isCurrent()) return [];
      const c =
        presentation.backgroundColorState === 'active' ? presentation.backgroundColor : undefined;
      if (
        write(
          'background-color',
          c ? `rgba(${c[0] * 255}, ${c[1] * 255}, ${c[2] * 255}, ${c[3]})` : undefined
        )
      )
        accepted.push('background-color');
      return accepted;
    },
  });
  return sink;
}
