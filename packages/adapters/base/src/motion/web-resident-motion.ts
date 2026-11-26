import { webMotionAncestors } from './web-motion-style-ownership';
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
  let containingBlock: HTMLElement | null = null,
    containingBlockWidth: number | null = null,
    resize: ResizeObserver | null = null;
  let widthRequested = false,
    widthNeedsContainingBlock = false;
  const widthObservations = new Set<HTMLElement>();
  let widthObservationGeneration = 0;
  const composedParent = (node: HTMLElement): HTMLElement | null => {
    if (node.assignedSlot) return node.assignedSlot;
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode();
    return 'host' in root ? ((root as ShadowRoot).host as HTMLElement) : null;
  };
  function observeWidthTargets(targets: readonly HTMLElement[]) {
    const next = new Set(targets),
      observer = resize,
      observationGeneration = ++widthObservationGeneration;
    for (const old of widthObservations) {
      if (next.has(old)) continue;
      widthObservations.delete(old);
      observer?.unobserve(old);
      if (resize !== observer || observationGeneration !== widthObservationGeneration) return;
    }
    for (const target of next) {
      if (widthObservations.has(target)) continue;
      // Publish ownership before a host call which may synchronously reenter.
      widthObservations.add(target);
      observer?.observe(target, { box: 'content-box' });
      if (resize !== observer || observationGeneration !== widthObservationGeneration) return;
    }
  }
  /** Layout classification and content-box measurement, never a recovered width target. */
  function widthLayout(classify = true): {
    supported: boolean;
    reason?: string;
  } {
    let parent = composedParent(el);
    // A split Shadow host and its slots may have no layout box. Walk the composed tree.
    while (parent && win?.getComputedStyle(parent).display === 'contents')
      parent = composedParent(parent);
    if (parent !== containingBlock) {
      containingBlock = parent;
      containingBlockWidth = null;
    }
    // A delivery without a current-block sample must not retire and reobserve
    // the pending ancestor chain: those new observations would trigger more
    // deliveries, including when the real block has no initial size record.
    if (widthNeedsContainingBlock && containingBlockWidth === null) observePendingWidthTargets();
    else observeWidthTargets(parent ? [parent] : []);
    if (!win || !parent) return { supported: false, reason: 'containing-block-unavailable' };
    // Even without a width sample, a style flush can change the containing
    // block. Keep its observation current without classifying an absent sample.
    if (!classify) return { supported: false };
    const own = win.getComputedStyle(el),
      block = win.getComputedStyle(parent);
    const horizontal = (value: string) => !value || value === 'horizontal-tb';
    const normalPosition = (value: string) =>
      !value || ['static', 'relative', 'sticky'].includes(value);
    const unclamped =
      (!own.minWidth || ['0px', '0', 'auto'].includes(own.minWidth)) &&
      (!own.maxWidth || own.maxWidth === 'none');
    if (
      !normalPosition(own.position) ||
      !normalPosition(block.position) ||
      !horizontal(own.writingMode) ||
      !horizontal(block.writingMode) ||
      !unclamped ||
      !['block', 'flow-root'].includes(block.display) ||
      (block.cssFloat && block.cssFloat !== 'none') ||
      !['block', 'flow-root', 'inline-block'].includes(own.display)
    )
      return { supported: false, reason: 'layout-profile-unavailable' };
    return { supported: true };
  }
  function observePendingWidthTargets(): void {
    // A nonzero percentage cannot produce a width until a physical basis exists.
    // Keep the same observer live on a finite composed chain without forcing CSS
    // layout. A real delivery must still identify and measure the actual block.
    const candidates: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    for (
      let parent = composedParent(el);
      parent && !seen.has(parent);
      parent = composedParent(parent)
    ) {
      seen.add(parent);
      candidates.push(parent);
    }
    if (containingBlock && !seen.has(containingBlock)) {
      containingBlock = null;
      containingBlockWidth = null;
    }
    observeWidthTargets(candidates);
  }
  function widthEnvironment(classify = true): {
    supported: boolean;
    reason?: string;
  } {
    if (!widthNeedsContainingBlock || containingBlockWidth !== null) return widthLayout(classify);
    observePendingWidthTargets();
    return { supported: false, reason: 'containing-block-unavailable' };
  }
  type InlineDeclaration = { value: string; priority: string };
  type Lease = {
    before: InlineDeclaration;
    written: InlineDeclaration;
    pending?: InlineDeclaration;
  };
  const leases = new Map<string, Lease>();
  const lost = new Set<string>();
  // Canonicalize declarations without changing the physical surface. Ownership
  // stays exact; numeric adoption tolerance must not claim a foreign declaration.
  const normalization = doc.createElement('span').style;
  const readInline = (property: string): InlineDeclaration => ({
    value: el.style.getPropertyValue(property),
    priority: el.style.getPropertyPriority(property),
  });
  const sameInline = (left: InlineDeclaration, right: InlineDeclaration) =>
    left.value === right.value && left.priority === right.priority;
  function stillOwned(property: string, lease: Lease): boolean {
    const actual = readInline(property);
    if (sameInline(actual, lease.written)) return true;
    return lease.pending !== undefined && sameInline(actual, lease.pending);
  }
  function detectLoss() {
    for (const [property, lease] of leases)
      if (!stillOwned(property, lease)) {
        lost.add(property);
        leases.delete(property);
      }
  }
  function releaseLease(property: string, lease: Lease) {
    if (leases.get(property) !== lease) return;
    const owned = stillOwned(property, lease);
    // Retire this identity before calling the host: restoration may reenter and
    // establish another lease, even with the same serialized value.
    leases.delete(property);
    if (!owned) {
      lost.add(property);
      return;
    }
    if (lease.before.value)
      el.style.setProperty(property, lease.before.value, lease.before.priority);
    else el.style.removeProperty(property);
  }
  function clear() {
    for (const [property, lease] of [...leases]) releaseLease(property, lease);
  }
  function widthPixels(value: string): number | null {
    const text = value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?px$/i.test(text)) return null;
    const pixels = Number(text.slice(0, -2));
    return Number.isFinite(pixels) ? pixels : null;
  }
  function write(
    property: string,
    value: string | undefined,
    isCurrent: () => boolean,
    expectedWidth?: number
  ): boolean {
    detectLoss();
    if (!isCurrent() || lost.has(property)) return false;
    if (value === undefined) {
      const old = leases.get(property);
      if (old) releaseLease(property, old);
      return isCurrent();
    }
    normalization.setProperty(property, value);
    const intended = normalization.getPropertyValue(property);
    normalization.removeProperty(property);
    if (!isCurrent()) return false;
    const beforeWrite = readInline(property);
    const previous = leases.get(property);
    const lease: Lease = {
      before: previous?.before ?? beforeWrite,
      written: beforeWrite,
      pending: { value: intended, priority: '' },
    };
    // Release can run synchronously inside setProperty after it writes. Publish
    // the pending lease first so cleanup can already recognize that declaration.
    leases.set(property, lease);
    try {
      el.style.setProperty(property, value);
    } catch (error) {
      releaseLease(property, lease);
      throw error;
    }
    if (leases.get(property) !== lease) return false;
    if (!isCurrent()) {
      releaseLease(property, lease);
      return false;
    }
    const written = readInline(property);
    const writtenWidth = expectedWidth === undefined ? null : widthPixels(written.value);
    if (
      expectedWidth !== undefined &&
      (!sameInline(written, lease.pending!) ||
        writtenWidth === null ||
        Math.abs(writtenWidth - expectedWidth) > 0.02)
    ) {
      // Keep an unchanged earlier lease after a refused write so it can be
      // released. Preserve a different synchronous writer's value and priority.
      if (!sameInline(written, beforeWrite)) {
        lost.add(property);
        leases.delete(property);
      } else if (previous) delete lease.pending;
      else leases.delete(property);
      return false;
    }
    lease.written = written;
    delete lease.pending;
    return true;
  }
  let paletteRequested = false;
  let paletteInvalidation: (() => void) | null = null;
  let paletteLease: {
    invalidate: () => void;
    off: (() => void) | null;
  } | null = null;
  let reconcilingPalette = false;
  function reconcilePaletteSubscription() {
    if (reconcilingPalette) return;
    reconcilingPalette = true;
    try {
      // Source subscribe/cleanup may synchronously commit a newer frame or release
      // this view. Reconcile its latest demand after the external call returns.
      while (true) {
        const invalidate = paletteInvalidation;
        const needed = paletteRequested && invalidate !== null && paletteSource != null;
        const old = paletteLease;
        if (old && (!needed || old.invalidate !== invalidate)) {
          paletteLease = null;
          const off = old.off;
          old.off = null;
          off?.();
          continue;
        }
        if (!needed || old) return;
        const lease = {
          invalidate: invalidate!,
          off: null as (() => void) | null,
        };
        paletteLease = lease;
        try {
          lease.off = paletteSource!.subscribe(() => {
            if (
              paletteLease === lease &&
              paletteRequested &&
              paletteInvalidation === lease.invalidate
            )
              lease.invalidate();
          });
        } catch (error) {
          if (paletteLease === lease) paletteLease = null;
          throw error;
        }
      }
    } finally {
      reconcilingPalette = false;
    }
  }
  const sink = createResidentMotionProjector({
    diagnostics: options.diagnostics,
    now: () => win?.performance.now() ?? 0,
    environment: (
      requestedProperties,
      targetProperties = requestedProperties,
      needsContainingBlock = false
    ) => {
      widthRequested = targetProperties.includes('width');
      widthNeedsContainingBlock = widthRequested && needsContainingBlock;
      // Theme authority and its diagnostics belong to the declared color channel,
      // including frames whose target cannot be painted by resident motion.
      const colorRequested = requestedProperties.includes('background-color');
      paletteRequested = colorRequested;
      reconcilePaletteSubscription();
      detectLoss();
      if (!widthRequested) observeWidthTargets(containingBlock ? [containingBlock] : []);
      const layout = widthRequested ? widthEnvironment() : { supported: false };
      const preference = readWebPreference(doc, 'preference.reducedMotion');
      // Only the color channel consumes theme authority. Keep each admitted color
      // frame live, without querying computed theme inputs for geometry-only frames.
      const palette = colorRequested && paletteRequested ? paletteSource?.current() : undefined;
      // Only length channels consume the root unit basis. Color authority stays
      // in the palette source and never needs a separate root-font style read.
      const pendingWidthBasis = widthNeedsContainingBlock && containingBlockWidth === null;
      const lengthRequested = targetProperties.some(
        (property) => property === 'translate' || (property === 'width' && !pendingWidthBasis)
      );
      const font =
        win && lengthRequested
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
            ? ['translate', 'background-color', 'width']
            : ['background-color', 'width']) as ResidentMotionProperty[]
        ).filter((property) => !lost.has(property) && (property !== 'width' || layout.supported)),
        projectionDiagnostics: [
          ...[...lost].map((property) => `${property}:external-inline-owner`),
          ...(!widthRequested || layout.supported ? [] : [`width:${layout.reason}`]),
        ],
        width,
        height,
        containingBlockWidth,
        rootFontPx: Number.isFinite(font) ? font : null,
        palette: palette?.colors ?? {},
        paletteRevision: palette?.revision ?? 0,
        paletteDiagnostics: palette?.diagnostics ?? [],
      };
    },
    subscribe(invalidate) {
      paletteInvalidation = invalidate;
      const getter = (key: string) => readWebPreference(doc, key);
      const preference = createDefaultWebPreferenceSource(getter, doc)?.subscribe(
        ['preference.reducedMotion'],
        invalidate
      );
      // ResizeObserver borderBoxSize supplies layout-space (not transformed viewport) units.
      let observerForSubscription: ResizeObserver | null = null;
      observerForSubscription =
        typeof win?.ResizeObserver === 'function'
          ? new win.ResizeObserver((entries) => {
              const observer = observerForSubscription;
              if (observer === null || resize !== observer) return;
              // Delivery is the first point at which a pending percentage can
              // acquire a basis. Select the current block using the original
              // layout rules; measurements of other candidates do not count.
              if (widthNeedsContainingBlock && containingBlockWidth === null) widthLayout(false);
              if (resize !== observer) return;
              const entry = entries.find((e) => e.target === el);
              const box = entry?.borderBoxSize?.[0];
              const vertical = win.getComputedStyle(el).writingMode.startsWith('vertical');
              if (resize !== observer) return;
              const physicalWidth = box ? (vertical ? box.blockSize : box.inlineSize) : null;
              const physicalHeight = box ? (vertical ? box.inlineSize : box.blockSize) : null;
              if (entry) {
                width =
                  physicalWidth !== null && Number.isFinite(physicalWidth) ? physicalWidth : null;
                height =
                  physicalHeight !== null && Number.isFinite(physicalHeight)
                    ? physicalHeight
                    : null;
              }
              const parentEntry = entries.find((e) => e.target === containingBlock);
              if (parentEntry) {
                const box = parentEntry.contentBoxSize?.[0];
                const measured = box?.inlineSize ?? parentEntry.contentRect?.width;
                containingBlockWidth =
                  typeof measured === 'number' && Number.isFinite(measured) && measured >= 0
                    ? measured
                    : null;
              }
              invalidate();
            })
          : null;
      resize = observerForSubscription;
      resize?.observe(el, { box: 'border-box' });
      for (const target of widthObservations) resize?.observe(target, { box: 'content-box' });
      const observer =
        typeof win?.MutationObserver === 'function' ? new win.MutationObserver(invalidate) : null;
      for (const node of webMotionAncestors(el))
        observer?.observe(node, {
          attributes: true,
          attributeFilter: ['hidden', 'data-pui-view-pending', 'data-pui-view-detached'],
        });
      doc.addEventListener('visibilitychange', invalidate);
      return () => {
        if (paletteInvalidation === invalidate) {
          paletteInvalidation = null;
          paletteRequested = false;
        }
        preference?.();
        reconcilePaletteSubscription();
        const oldResize = resize;
        resize = null;
        widthObservations.clear();
        oldResize?.disconnect();
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
      const measuredParent = containingBlock,
        measuredWidth = containingBlockWidth;
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
            : undefined,
          isCurrent
        )
      )
        accepted.push('translate');
      if (!isCurrent()) return [];
      const c =
        presentation.backgroundColorState === 'active' ? presentation.backgroundColor : undefined;
      if (
        write(
          'background-color',
          c ? `rgba(${c[0] * 255}, ${c[1] * 255}, ${c[2] * 255}, ${c[3]})` : undefined,
          isCurrent
        )
      )
        accepted.push('background-color');
      if (!isCurrent()) return [];
      const layout = widthRequested
        ? widthEnvironment(presentation.width !== undefined)
        : { supported: false };
      if (!isCurrent()) return [];
      const sameBasis =
        measuredParent === containingBlock && measuredWidth === containingBlockWidth;
      const activeWidth =
        layout.supported && sameBasis && presentation.widthState === 'active'
          ? presentation.width
          : undefined;
      // A pre-existing inline width is an external layout owner, including while idle.
      if (widthRequested && !leases.has('width') && el.style.getPropertyValue('width'))
        lost.add('width');
      const wroteWidth = write(
        'width',
        activeWidth === undefined ? undefined : `${activeWidth}px`,
        isCurrent,
        activeWidth
      );
      if (!isCurrent()) return [];
      let adoptedWidth = false;
      if (
        wroteWidth &&
        layout.supported &&
        sameBasis &&
        presentation.width !== undefined &&
        Number.isFinite(presentation.width)
      ) {
        // Verify adoption of the typed sample, including the first/settled
        // semantic anchor. Computed CSS never supplies targets or samples.
        // CSS layout and serialization may quantize subpixel widths.
        try {
          const actual = widthPixels(win?.getComputedStyle(el).width ?? '');
          adoptedWidth = actual !== null && Math.abs(actual - presentation.width) <= 0.02;
        } catch {
          adoptedWidth = false;
        }
      }
      if (!isCurrent()) return [];
      if (adoptedWidth) accepted.push('width');
      else {
        // The projector retires rejected samples and their reversal anchors.
        // Release only our declaration; an external takeover retains ownership.
        write('width', undefined, isCurrent);
        if (!isCurrent()) return [];
      }
      return accepted;
    },
  });
  return sink;
}
