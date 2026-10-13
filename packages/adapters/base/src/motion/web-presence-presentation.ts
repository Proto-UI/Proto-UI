import { acquireWebTranslation } from '@proto.ui/module-positioning';
import type { EffectsPort, PresentationViewBinding } from '@proto.ui/core';
import {
  createPresencePresentationProjector,
  type PresencePresentationSink,
  type PresencePresentationFrame,
} from '@proto.ui/module-feedback';
import {
  createDefaultWebPreferenceSource,
  readWebPreference,
} from '../platform/web-preference-source';
export type WebPresencePresentationOptions = {
  /** Native host adoption signal. Cleanup belongs to this physical view. */
  subscribeDocumentChange?: (
    invalidate: (document: Document, phase: 'retire' | 'ready') => void
  ) => () => void;
};
/** Document identity is part of the physical binding, never semantic phase authority. */
export function createWebPresencePresentationSink(
  el: HTMLElement,
  effects: EffectsPort,
  options: WebPresencePresentationOptions = {}
): PresencePresentationSink {
  let document = el.ownerDocument;
  let current: PresencePresentationSink | null = null;
  let frame: PresencePresentationFrame | null = null;
  let view: number | null = null;
  let binding = Object.freeze({}) as PresentationViewBinding;
  let retired = false,
    suspended = false,
    installing = false;
  let off: (() => void) | null = null;
  let retirementDepth = 0;
  let pendingReady: Document | null = null;
  const reasons = new Set<string>();
  const safe = (operation: () => void, reason = 'document-cleanup-failed') => {
    try {
      operation();
    } catch {
      reasons.add(reason);
    }
  };
  const create = () => {
    const captured = document;
    return createDocumentPresenceSink(
      el,
      effects,
      binding,
      () => !retired && !suspended && document === captured && el.ownerDocument === captured,
      refresh
    );
  };
  function retireDocument(nextDocument: Document) {
    if (retired) return;
    suspended = true;
    // A newly created destination sink can subscribe mid-adoption. It still
    // waits for ready, even though it has no prior document binding to rotate.
    if (document === nextDocument) return;
    const old = current,
      previous = frame,
      previousView = view;
    current = null;
    document = nextDocument;
    binding = Object.freeze({}) as PresentationViewBinding;
    retirementDepth++;
    // Revoke already-issued receipts before any old teardown callback runs.
    safe(() => previous?.bind(binding), 'document-binding-failed');
    safe(() => {
      for (const reason of old?.diagnostics?.() ?? []) reasons.add(reason);
    });
    reasons.add('document-rebound');
    if (old && previousView !== null) safe(() => old.release(previousView));
    retirementDepth--;
    if (!retirementDepth && pendingReady) {
      const ready = pendingReady;
      pendingReady = null;
      admitDocument(ready);
    }
  }
  function admitDocument(nextDocument: Document) {
    if (retired || document !== nextDocument || el.ownerDocument !== nextDocument) return;
    if (retirementDepth) {
      pendingReady = nextDocument;
      return;
    }
    suspended = false;
    current ??= create();
    if (frame) current.commit(frame);
  }
  function refresh() {
    if (retired || suspended || document === el.ownerDocument) return;
    const nextDocument = el.ownerDocument;
    retireDocument(nextDocument);
    admitDocument(nextDocument);
  }
  const documentChanged = (nextDocument: Document, phase: 'retire' | 'ready') => {
    if (phase === 'retire') retireDocument(nextDocument);
    else if (suspended) admitDocument(nextDocument);
  };
  return {
    commit(next) {
      if (retired) return;
      frame = next;
      view = next.view;
      if (suspended || installing) return;
      if (!off && options.subscribeDocumentChange) {
        installing = true;
        let cleanup: (() => void) | null = null;
        safe(() => {
          cleanup = options.subscribeDocumentChange!(documentChanged);
        }, 'document-subscription-failed');
        installing = false;
        if (retired) {
          if (cleanup) safe(cleanup);
          return;
        }
        off = cleanup;
      }
      if (suspended || !frame) return;
      if (document !== el.ownerDocument) {
        refresh();
        return;
      }
      current ??= create();
      current.commit(frame);
    },
    cancel() {
      frame = null;
      current?.cancel();
    },
    settle(outcome) {
      refresh();
      return current?.settle(outcome) ?? false;
    },
    release(epoch) {
      if (retired || view !== epoch) return;
      retired = true;
      const old = current,
        cleanup = off;
      current = null;
      frame = null;
      off = null;
      if (cleanup) safe(cleanup);
      if (old) safe(() => old.release(epoch));
    },
    diagnostics: () => [...reasons, ...(current?.diagnostics?.() ?? [])],
  };
}

/** One document epoch. Geometry is read as layout input, never as a target. */
function createDocumentPresenceSink(
  el: HTMLElement,
  effects: EffectsPort,
  binding: PresentationViewBinding,
  live: () => boolean,
  refresh: () => void
): PresencePresentationSink {
  const doc = el.ownerDocument,
    win = doc.defaultView;
  let translation: ReturnType<typeof acquireWebTranslation> | null = null;
  const baseline = new Map<string, { value: string; priority: string }>();
  const writes = new Map<string, { value: string; priority: string }>();
  const lost = new Set<string>();
  const owned = (name: string, value: { value: string; priority: string }) =>
    el.style.getPropertyValue(name) === value.value &&
    el.style.getPropertyPriority(name) === value.priority;
  const detectLoss = () => {
    for (const [name, value] of writes)
      if (!owned(name, value)) {
        lost.add(name);
        writes.delete(name);
        baseline.delete(name);
      }
  };
  const clear = () => {
    translation?.release();
    translation = null;
    for (const [name, value] of writes)
      if (owned(name, value)) {
        const before = baseline.get(name)!;
        if (before.value) el.style.setProperty(name, before.value, before.priority);
        else el.style.removeProperty(name);
      }
    writes.clear();
    baseline.clear();
  };
  const write = (name: string, value: string) => {
    detectLoss();
    if (lost.has(name)) return false;
    if (!baseline.has(name))
      baseline.set(name, {
        value: el.style.getPropertyValue(name),
        priority: el.style.getPropertyPriority(name),
      });
    el.style.setProperty(name, value);
    writes.set(name, {
      value: el.style.getPropertyValue(name),
      priority: el.style.getPropertyPriority(name),
    });
    return true;
  };
  const px = (value: string | undefined) =>
    value && /^-?(?:\d+\.?\d*|\.\d+)px$/.test(value) ? Number.parseFloat(value) : null;
  const ancestors = () => {
    const result: HTMLElement[] = [];
    let node: HTMLElement | null = el;
    while (node) {
      result.push(node);
      const root: Node = node.getRootNode();
      node =
        node.parentElement ?? ('host' in root ? ((root as ShadowRoot).host as HTMLElement) : null);
    }
    return result;
  };
  return createPresencePresentationProjector({
    binding,
    now: () => win?.performance.now() ?? performance.now(),
    environment() {
      detectLoss();
      const css = win?.getComputedStyle(el);
      const dimension = (axis: 'width' | 'height') => {
        let value = px(css?.[axis]);
        if (value === null) return null;
        if (css?.boxSizing !== 'border-box') {
          const keys =
            axis === 'width'
              ? (['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'] as const)
              : (['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'] as const);
          for (const key of keys) {
            const extra = px(css?.[key]);
            if (extra === null) return null;
            value += extra;
          }
        }
        return Number.isFinite(value) && value >= 0 ? value : null;
      };
      const preference = readWebPreference(doc, 'preference.reducedMotion');
      return {
        preference:
          preference === 'no-preference' || preference === 'reduce' ? preference : 'unknown',
        visible:
          el.isConnected &&
          doc.visibilityState !== 'hidden' &&
          !ancestors().some((node) =>
            node.matches('[hidden],[data-pui-view-pending],[data-pui-view-detached]')
          ),
        width: dimension('width'),
        height: dimension('height'),
        rootFontPx: px(win?.getComputedStyle(doc.documentElement).fontSize),
        supported: (['translate', 'opacity'] as const).filter(
          (name) =>
            !lost.has(name) && (name !== 'translate' || !!win?.CSS?.supports?.('translate', '1px'))
        ),
      };
    },
    subscribe(invalidate) {
      const callback = () => {
        if (live()) invalidate();
        else refresh();
      };
      const off = createDefaultWebPreferenceSource(
        (key) => readWebPreference(doc, key),
        doc
      )?.subscribe(['preference.reducedMotion'], callback);
      const resize = win?.ResizeObserver ? new win.ResizeObserver(callback) : null;
      resize?.observe(el);
      const mutation = win?.MutationObserver ? new win.MutationObserver(callback) : null;
      for (const node of ancestors())
        mutation?.observe(node, {
          attributes: true,
          attributeFilter: ['hidden', 'data-pui-view-pending', 'data-pui-view-detached'],
        });
      doc.addEventListener('visibilitychange', callback);
      return () => {
        let failed = false;
        let firstError: unknown;
        for (const cleanup of [
          () => off?.(),
          () => resize?.disconnect(),
          () => mutation?.disconnect(),
          () => doc.removeEventListener('visibilitychange', callback),
        ]) {
          try {
            cleanup();
          } catch (error) {
            if (!failed) {
              failed = true;
              firstError = error;
            }
          }
        }
        if (failed) throw firstError;
      };
    },
    requestFrame: (callback) =>
      win?.requestAnimationFrame(() => {
        if (live()) callback();
        else refresh();
      }) ?? null,
    cancelFrame: (ticket) => {
      if (typeof ticket === 'number') win?.cancelAnimationFrame(ticket);
    },
    project(style, sample, current) {
      if (!live()) {
        refresh();
        return false;
      }
      if (!current() || !live()) return false;
      effects.queueStyle(style);
      if (!current() || !live()) return false;
      effects.requestFlush();
      if (!current() || !live()) return false;
      detectLoss();
      if (sample.opacity !== undefined) {
        if (lost.has('opacity')) return false;
        if (!writes.has('opacity')) {
          const inline = el.style.getPropertyValue('opacity');
          const computed = win?.getComputedStyle(el).opacity ?? '';
          if ((inline && inline !== '1') || (computed && computed !== '1')) return false;
        }
      }
      if (sample.translate) {
        translation ??= acquireWebTranslation(el, 'presentation');
        if (!translation.canWrite()) return false;
      }
      // All channels pass ownership preflight before the first channel is written.
      if (
        sample.translate &&
        !translation!.set([
          { px: sample.translate[0], rootText: 0, ownBox: 0 },
          { px: sample.translate[1], rootText: 0, ownBox: 0 },
        ])
      )
        return false;
      if (!current() || !live()) return false;
      if (sample.opacity !== undefined && !write('opacity', String(sample.opacity))) return false;
      return current() && live();
    },
    release: clear,
  });
}
