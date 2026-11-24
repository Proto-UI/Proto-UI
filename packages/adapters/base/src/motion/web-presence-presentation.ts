import { runAllSteps } from '../host/synchronous-steps';
import { createWebMotionStyleOwnership, webMotionAncestors } from './web-motion-style-ownership';
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
import { PUI_PORTAL_PREPARING_ATTR } from '../host/view-visibility';
const zeroOpacityOwners = new WeakMap<Element, () => boolean>();

/** True only while this live presentation lease still owns its zero-opacity write. */
export function hasOwnedWebPresenceZeroOpacity(element: Element): boolean {
  return zeroOpacityOwners.get(element)?.() ?? false;
}

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
  const {
    writes,
    lost,
    owned,
    detectLoss,
    clear: clearOwnedStyles,
    write: writeOwnedStyle,
  } = createWebMotionStyleOwnership(el, (name) => {
    if (name === 'opacity') clearZeroOpacityOwner();
  });
  const ownsZeroOpacity = () => {
    const opacity = writes.get('opacity');
    return (
      live() && !!opacity && Number.parseFloat(opacity.value) === 0 && owned('opacity', opacity)
    );
  };
  const clearZeroOpacityOwner = () => {
    if (zeroOpacityOwners.get(el) === ownsZeroOpacity) zeroOpacityOwners.delete(el);
  };
  let styleRevision = 0;
  const clear = () => {
    styleRevision++;
    clearZeroOpacityOwner();
    translation?.release();
    translation = null;
    clearOwnedStyles();
  };
  const write = (name: string, value: string) => {
    styleRevision++;
    if (!writeOwnedStyle(name, value)) return false;
    if (name === 'opacity') {
      if (Number.parseFloat(value) === 0 && ownsZeroOpacity())
        zeroOpacityOwners.set(el, ownsZeroOpacity);
      else clearZeroOpacityOwner();
    }
    return true;
  };
  const px = (value: string | undefined) =>
    value && /^-?(?:\d+\.?\d*|\.\d+)px$/.test(value) ? Number.parseFloat(value) : null;
  const intrinsicBlockSize = () => {
    const lease = writes.get('block-size');
    if (lost.has('block-size') || (lease && !owned('block-size', lease))) return null;
    // The canonical style owner restores the current semantic baseline. A
    // constrained scroll extent cannot prove shrinkage; release and reacquire
    // this single lease synchronously around the actual layout read.
    const revision = styleRevision;
    if (lease && !writeOwnedStyle('block-size', undefined)) return null;
    const semantic = {
      value: el.style.getPropertyValue('block-size'),
      priority: el.style.getPropertyPriority('block-size'),
    };
    try {
      const css = win?.getComputedStyle(el);
      const vertical =
        css?.writingMode?.startsWith('vertical') || css?.writingMode?.startsWith('sideways');
      const value = px(css?.blockSize) ?? px(vertical ? css?.width : css?.height);
      return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
    } finally {
      if (lease && live() && revision === styleRevision && !writes.has('block-size')) {
        if (owned('block-size', semantic)) {
          writeOwnedStyle('block-size', lease.value);
        } else {
          // Preserve takeover during the read; never resurrect an old lease.
          lost.add('block-size');
        }
      }
    }
  };
  const fixedContainingBlockHeight = (): number | null => {
    if (!win || win.getComputedStyle(el).position !== 'fixed') return null;
    // The initial provider deliberately refuses other containing blocks. The
    // panel's own dimensions and transformed bounds are never a substitute.
    for (const node of webMotionAncestors(el).slice(1)) {
      const css = win.getComputedStyle(node);
      const nonNone = (value: string) => !!value && value !== 'none';
      if (
        [
          css.transform,
          css.translate,
          css.rotate,
          css.scale,
          css.perspective,
          css.filter,
          css.backdropFilter,
        ].some(nonNone) ||
        /(?:^|\s)(?:layout|paint|strict|content)(?:\s|$)/.test(css.contain) ||
        /(?:^|,|\s)(?:transform|translate|rotate|scale|perspective|filter|backdrop-filter|contain)(?:,|\s|$)/.test(
          css.willChange
        ) ||
        (css.contentVisibility && css.contentVisibility !== 'visible') ||
        (css.containerType && css.containerType !== 'normal')
      )
        return null;
    }
    const height = doc.documentElement.clientHeight || win.innerHeight;
    return Number.isFinite(height) && height >= 0 ? height : null;
  };
  const topMatchesValue = (baseline: number): boolean => {
    const value = win?.getComputedStyle(el).top;
    const pixels = px(value);
    if (pixels !== null) return Math.abs(pixels - baseline) < 0.01;
    // DOM-model providers can retain the computed percentage. This is only an
    // ownership comparison with the typed endpoint, never a semantic target.
    const percent = value?.match(/^(-?(?:\d+\.?\d*|\.\d+))%$/);
    const height = fixedContainingBlockHeight();
    return (
      !!percent &&
      height !== null &&
      Math.abs((Number(percent[1]) * height) / 100 - baseline) < 0.01
    );
  };
  return createPresencePresentationProjector({
    binding,
    now: () => win?.performance.now() ?? performance.now(),
    environment(channels = []) {
      detectLoss();
      const tree = webMotionAncestors(el);
      const preparing = tree.some((node) => node.hasAttribute(PUI_PORTAL_PREPARING_ATTR));
      // The portal still owns the first-render display barrier. Its temporarily
      // unavailable box must not be measured or borrowed from an earlier layout;
      // current preference, visibility and channel ownership remain observable.
      const css = preparing ? undefined : win?.getComputedStyle(el);
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
      const containingBlockHeight =
        !preparing && channels.includes('top') ? fixedContainingBlockHeight() : null;
      return {
        preference:
          preference === 'no-preference' || preference === 'reduce' ? preference : 'unknown',
        visible:
          el.isConnected &&
          doc.visibilityState !== 'hidden' &&
          !tree.some((node) =>
            node.matches('[hidden],[data-pui-view-pending],[data-pui-view-detached]')
          ),
        preparing,
        width: dimension('width'),
        height: dimension('height'),
        rootFontPx: px(win?.getComputedStyle(doc.documentElement).fontSize),
        intrinsicBlockSize:
          !preparing && channels.includes('blockSize') ? intrinsicBlockSize() : null,
        containingBlockHeight,
        supported: (['translate', 'opacity', 'top', 'blockSize'] as const).filter(
          (name) =>
            !lost.has(name) &&
            (name !== 'translate' || !!win?.CSS?.supports?.('translate', '1px')) &&
            // Preparing withholds geometry, not the channel candidate. The
            // projector waits without acknowledging; readiness checks the
            // actual containing-block profile before any transient top write.
            (name !== 'top' || preparing || containingBlockHeight !== null) &&
            (name !== 'blockSize' ||
              (!lost.has('block-size') &&
                !lost.has('overflow') &&
                !!win?.CSS?.supports?.('block-size', '1px')))
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
      for (const node of webMotionAncestors(el))
        mutation?.observe(node, {
          attributes: true,
          attributeFilter: [
            'hidden',
            'data-pui-view-pending',
            'data-pui-view-detached',
            PUI_PORTAL_PREPARING_ATTR,
          ],
        });
      doc.addEventListener('visibilitychange', callback);
      win?.addEventListener('resize', callback);
      return () => {
        runAllSteps([
          () => off?.(),
          () => resize?.disconnect(),
          () => mutation?.disconnect(),
          () => doc.removeEventListener('visibilitychange', callback),
          () => win?.removeEventListener('resize', callback),
        ]);
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
          const expected = sample.opacityBaseline ?? 1;
          const computed = win?.getComputedStyle(el).opacity ?? '';
          const value = computed === '' ? 1 : Number(computed);
          if (!Number.isFinite(value) || Math.abs(value - expected) > 0.000001) return false;
        }
      }
      if (sample.translate) {
        translation ??= acquireWebTranslation(el, 'presentation');
        if (!translation.canWrite()) return false;
      }
      if (sample.blockSize !== undefined && (lost.has('block-size') || lost.has('overflow')))
        return false;
      if (sample.top !== undefined) {
        if (lost.has('top') || sample.topBaseline === undefined) return false;
        if (!writes.has('top') && !topMatchesValue(sample.topBaseline)) return false;
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
      if (!current() || !live()) return false;
      if (sample.blockSize !== undefined) {
        if (!write('overflow', 'hidden')) return false;
        if (!current() || !live()) return false;
        if (!write('block-size', `${sample.blockSize}px`)) return false;
      }
      if (!current() || !live()) return false;
      if (sample.top !== undefined && !write('top', `${sample.top}px`)) return false;
      if (!current() || !live()) return false;
      // Inline ownership alone does not prove adoption: a host refusal or a
      // foreign !important cascade may leave the declared property unchanged.
      // Compare only with the already typed sample; computed values never
      // replace the semantic target or enter the interpolation state.
      if (sample.opacity !== undefined) {
        const computed = win?.getComputedStyle(el).opacity ?? '';
        const applied = computed === '' ? 1 : Number(computed);
        if (!Number.isFinite(applied) || Math.abs(applied - sample.opacity) > 0.000001)
          return false;
      }
      if (!current() || !live()) return false;
      if (sample.top !== undefined && !topMatchesValue(sample.top)) return false;
      return current() && live();
    },
    release: clear,
  });
}
