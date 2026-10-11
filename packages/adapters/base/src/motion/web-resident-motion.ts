import type { EffectsPort } from '@proto.ui/core';
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
  current(): Readonly<{ revision: number; colors: Readonly<Record<string, MotionRgba>> }>;
  subscribe(invalidate: () => void): () => void;
};
/** Host environment input, not a component-specific styling escape hatch. */
export type WebResidentMotionOptions = {
  palette?: ResidentMotionPaletteSource;
  diagnostics?: (reasons: readonly string[]) => void;
};
/** One physical surface; replacement gets a fresh lease. No semantic DOM reads. */
export function createWebResidentMotionSink(
  el: HTMLElement,
  effects: EffectsPort,
  options: WebResidentMotionOptions = {}
): ResidentMotionSink {
  const doc = el.ownerDocument,
    win = doc.defaultView;
  let width: number | null = null,
    height: number | null = null;
  function ancestors(): HTMLElement[] {
    const result: HTMLElement[] = [];
    let current: HTMLElement | null = el;
    while (current) {
      result.push(current);
      const root = current.getRootNode();
      current =
        current.parentElement ??
        ('host' in root ? ((root as ShadowRoot).host as HTMLElement) : null);
    }
    return result;
  }
  const original = new Map<string, { value: string; priority: string }>();
  let lastWritten = new Map<string, string>();
  function clear() {
    for (const [property, written] of lastWritten) {
      if (el.style.getPropertyValue(property) !== written) continue;
      const before = original.get(property)!;
      if (before.value) el.style.setProperty(property, before.value, before.priority);
      else el.style.removeProperty(property);
    }
    lastWritten.clear();
    original.clear();
  }
  function write(property: string, value: string | undefined) {
    if (value === undefined) {
      const old = lastWritten.get(property);
      if (old !== undefined && el.style.getPropertyValue(property) === old) {
        const before = original.get(property)!;
        if (before.value) el.style.setProperty(property, before.value, before.priority);
        else el.style.removeProperty(property);
      }
      lastWritten.delete(property);
      original.delete(property);
      return;
    }
    if (!original.has(property))
      original.set(property, {
        value: el.style.getPropertyValue(property),
        priority: el.style.getPropertyPriority(property),
      });
    el.style.setProperty(property, value);
    lastWritten.set(property, el.style.getPropertyValue(property));
  }
  const sink = createResidentMotionProjector({
    diagnostics: options.diagnostics,
    now: () => win?.performance.now() ?? 0,
    environment: () => {
      const preference = readWebPreference(doc, 'preference.reducedMotion');
      const palette = options.palette?.current();
      // Root font is a host unit basis, never a recovered style target.
      const font = win
        ? Number.parseFloat(win.getComputedStyle(doc.documentElement).fontSize)
        : NaN;
      const hidden = ancestors().some((node) =>
        node.matches('[hidden],[data-pui-view-pending],[data-pui-view-detached]')
      );
      return {
        preference:
          preference === 'reduce' || preference === 'no-preference' ? preference : 'unknown',
        visible: el.isConnected && !hidden && doc.visibilityState !== 'hidden',
        supportedProperties: (win?.CSS?.supports?.('translate', '1px')
          ? ['translate', 'background-color']
          : ['background-color']) as readonly ('translate' | 'background-color')[],
        width,
        height,
        rootFontPx: Number.isFinite(font) ? font : null,
        palette: palette?.colors ?? {},
        paletteRevision: palette?.revision ?? 0,
      };
    },
    subscribe(invalidate) {
      const getter = (key: string) => readWebPreference(doc, key);
      const preference = createDefaultWebPreferenceSource(getter, doc)?.subscribe(
        ['preference.reducedMotion'],
        invalidate
      );
      const offPalette = options.palette?.subscribe(invalidate);
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
      for (const node of ancestors())
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
      if (!isCurrent()) return;
      effects.queueStyle(style);
      if (!isCurrent()) return;
      effects.requestFlush();
      if (!isCurrent()) return;
      write(
        'translate',
        presentation.translate
          ? `${presentation.translate[0]}px ${presentation.translate[1]}px`
          : undefined
      );
      if (!isCurrent()) return;
      const c = presentation.backgroundColor;
      write(
        'background-color',
        c ? `rgba(${c[0] * 255}, ${c[1] * 255}, ${c[2] * 255}, ${c[3]})` : undefined
      );
    },
  });
  return sink;
}
