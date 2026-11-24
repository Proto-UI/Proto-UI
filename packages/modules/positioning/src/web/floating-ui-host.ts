import { createTargetAlignmentLease } from './target-alignment-host';
import { resolveWebInputOriginAnchor } from './input-origin-anchor';
import { observeRootSpace } from './root-space-observer';
import {
  createBorderBoxSizeLease,
  hasBorderBoxInlineClipping,
  measureBorderBoxInlineGutter,
} from './border-box-size-lease';
import { ownStyles, hasOwnedStyle } from './owned-style-lease';
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  platform as domPlatform,
  shift,
  size,
  type Dimensions,
  type Middleware,
  type Placement,
  type Platform,
} from '@floating-ui/dom';
import type {
  AnchoredPositionAlign,
  AnchoredPositionConfig,
  AnchoredPositionConnection,
  AnchoredPositionSide,
  TargetAlignmentStatus,
} from '@proto.ui/core';
import type { AnchoredPositionHost, AnchoredPositionHostLease } from '../caps';

function toPlacement(config: AnchoredPositionConfig): Placement {
  return config.align === 'center' ? config.side : `${config.side}-${config.align}`;
}

function fromPlacement(placement: Placement): {
  side: AnchoredPositionSide;
  align: AnchoredPositionAlign;
} {
  const [side, align] = placement.split('-') as [AnchoredPositionSide, AnchoredPositionAlign?];
  return { side, align: align ?? 'center' };
}

function isElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

// Temporary native diagnosis. No values are collected without the test-installed
// sink; factories let that sink reject unrelated leases before reading details.
const decisionTraceKey = Symbol.for('proto.ui.positioning.decision-trace');
type DecisionTrace = (details: () => Record<string, unknown>) => void;
function decisionSink(element: HTMLElement): unknown {
  try {
    return Reflect.get(element.ownerDocument.defaultView!, decisionTraceKey);
  } catch {
    return undefined;
  }
}
function basisDifferences(previous: string | undefined, current: string) {
  if (!previous) return null;
  const names = [
    'anchor.width',
    'anchor.height',
    'reference.offsetWidth',
    'reference.offsetHeight',
    'floating.offsetWidth',
    'floating.offsetHeight',
    'floating.clientWidth',
    'floating.clientHeight',
    'floating.scrollWidth',
    'floating.scrollHeight',
    'root.clientWidth',
    'root.clientHeight',
    'body.clientWidth',
    'viewport.width',
    'viewport.height',
    'viewport.scale',
    'viewport.offsetLeft',
    'viewport.offsetTop',
    'authoredStyle',
    'ancestors',
    'intrinsicStyle',
  ];
  const before = JSON.parse(previous) as unknown[];
  const after = JSON.parse(current) as unknown[];
  return names.flatMap((name, index) =>
    JSON.stringify(before[index]) === JSON.stringify(after[index])
      ? []
      : [{ name, before: before[index], after: after[index] }]
  );
}

function composedParent(node: Node): Node | null {
  if (node.nodeType === 1 && (node as Element).assignedSlot) return (node as Element).assignedSlot;
  return node.parentNode ?? (node.nodeType === 11 ? ((node as ShadowRoot).host ?? null) : null);
}

function isStrictComposedAncestor(target: EventTarget | null, element: HTMLElement): boolean {
  for (let node = composedParent(element); node; node = composedParent(node)) {
    if (node === target) return true;
  }
  return false;
}

/** Capture newly scrollable ancestors without treating a panel's own scroll as geometry. */
function observePositionScroll(reference: HTMLElement, floating: HTMLElement, update: () => void) {
  const roots = new Set<Document | ShadowRoot>();
  let disposed = false;
  const onScroll = (event: Event) => {
    if (disposed) return;
    const path = event.composedPath();
    // Only the outermost observed root handles this propagation. Do not retain
    // Event identity: callers may legally dispatch the same Event again.
    for (let index = path.length - 1; index >= 0; index--) {
      if (!roots.has(path[index] as Document | ShadowRoot)) continue;
      if (event.currentTarget !== path[index]) return;
      break;
    }
    const origin = path[0] ?? event.target;
    if (
      !(
        origin === reference.ownerDocument ||
        origin === floating.ownerDocument ||
        isStrictComposedAncestor(origin, reference) ||
        isStrictComposedAncestor(origin, floating)
      )
    )
      return;
    update();
  };
  const refresh = () => {
    if (disposed) return;
    const next = new Set<Document | ShadowRoot>([reference.ownerDocument, floating.ownerDocument]);
    for (const element of [reference, floating]) {
      for (let node: Node | null = element; node; node = composedParent(node)) {
        if (node.nodeType === 11 && 'host' in node) next.add(node as ShadowRoot);
      }
    }
    for (const root of roots) {
      if (!next.has(root)) {
        root.removeEventListener('scroll', onScroll, true);
        roots.delete(root);
      }
    }
    for (const root of next) {
      if (!roots.has(root)) {
        root.addEventListener('scroll', onScroll, true);
        roots.add(root);
      }
    }
  };
  refresh();
  return {
    refresh,
    dispose() {
      disposed = true;
      for (const root of roots) root.removeEventListener('scroll', onScroll, true);
      roots.clear();
    },
  };
}

const positioningStyleOutputs = new Set([
  'position',
  'left',
  'top',
  '--proto-ui-anchor-width',
  '--proto-ui-anchor-height',
  '--proto-ui-available-width',
  '--proto-ui-available-height',
]);

function authoredPositionStyle(element: HTMLElement): string {
  const values: string[] = [];
  for (let index = 0; index < element.style.length; index++) {
    const name = element.style.item(index);
    if (!positioningStyleOutputs.has(name))
      values.push(
        `${name}:${element.style.getPropertyValue(name)}!${element.style.getPropertyPriority(name)}`
      );
  }
  return values.sort().join(';');
}

/** Reuse measured natural dimensions only while their bounded input facts stay current. */
function observeIntrinsicSize(reference: HTMLElement, floating: HTMLElement, trace: DecisionTrace) {
  const document = floating.ownerDocument;
  const view = document.defaultView;
  let revision = 0;
  let disposed = false;
  let authored = authoredPositionStyle(floating);
  let projectedSide = floating.dataset.side;
  let projectedAlign = floating.dataset.align;
  const invalidate = () => {
    revision++;
    cache = null;
  };
  const mutations = (records: MutationRecord[]) => {
    const beforeRevision = revision;
    const invalidations: MutationRecord[] | null =
      typeof decisionSink(floating) === 'function' ? [] : null;
    for (const record of records) {
      if (record.target === floating && record.type === 'attributes') {
        if (record.attributeName === 'style') {
          const next = authoredPositionStyle(floating);
          if (next === authored) continue;
          authored = next;
        } else if (record.attributeName === 'data-side' && floating.dataset.side === projectedSide)
          continue;
        else if (record.attributeName === 'data-align' && floating.dataset.align === projectedAlign)
          continue;
      }
      invalidate();
      invalidations?.push(record);
    }
    if (invalidations?.length)
      trace(() => ({
        phase: 'intrinsic-mutation',
        beforeRevision,
        revision,
        records: invalidations.slice(0, 32).map((record) => ({
          type: record.type,
          targetIsFloating: record.target === floating,
          target:
            record.target instanceof Element
              ? { tag: record.target.localName, id: record.target.id }
              : { nodeType: record.target.nodeType },
          attribute: record.attributeName,
          oldValue: record.oldValue,
          valueAtDelivery:
            record.target instanceof Element && record.attributeName
              ? record.target.getAttribute(record.attributeName)
              : null,
          addedNodes: record.addedNodes.length,
          removedNodes: record.removedNodes.length,
        })),
        droppedMutationRecords: Math.max(0, invalidations.length - 32),
      }));
  };
  const observer =
    typeof view?.MutationObserver === 'function' ? new view.MutationObserver(mutations) : null;
  observer?.observe(floating, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeOldValue: typeof decisionSink(floating) === 'function',
  });
  const externalInvalidation = (event: Event) => {
    invalidate();
    trace(() => ({ phase: 'intrinsic-invalidation', reason: event.type, revision }));
  };
  floating.addEventListener('load', externalInvalidation, true);
  document.fonts?.addEventListener('loadingdone', externalInvalidation);
  document.fonts?.addEventListener('loadingerror', externalInvalidation);
  const basis = () => {
    const anchor = reference.getBoundingClientRect();
    const root = document.documentElement;
    const viewport = view?.visualViewport;
    const style = view?.getComputedStyle(floating);
    const intrinsicStyle = JSON.stringify([
      style?.font,
      style?.fontFamily,
      style?.fontSize,
      style?.fontWeight,
      style?.lineHeight,
      style?.letterSpacing,
      style?.whiteSpace,
      style?.boxSizing,
      style?.padding,
      style?.borderWidth,
      style?.display,
      style?.minWidth,
      style?.minHeight,
      style?.direction,
      style?.writingMode,
    ]);
    const ancestors: string[] = [];
    for (let node = composedParent(floating); node; node = composedParent(node)) {
      if (node.nodeType !== 1) continue;
      const element = node as Element;
      ancestors.push(
        JSON.stringify([
          element
            .getAttributeNames()
            .sort()
            .map((name) => `${name}=${element.getAttribute(name)}`),
          element.clientWidth,
          element.clientHeight,
          view?.getComputedStyle(element).transform,
        ])
      );
    }
    const context = JSON.stringify([
      anchor.width,
      anchor.height,
      reference.offsetWidth,
      reference.offsetHeight,
      root.clientWidth,
      root.clientHeight,
      document.body?.clientWidth,
      viewport?.width,
      viewport?.height,
      viewport?.scale,
      viewport?.offsetLeft,
      viewport?.offsetTop,
      authoredPositionStyle(floating),
      ancestors,
      intrinsicStyle,
    ]);
    return {
      offsetParent: floating.offsetParent,
      context,
      intrinsicStyle,
      scrollWidth: floating.scrollWidth,
      scrollHeight: floating.scrollHeight,
      values: JSON.stringify([
        anchor.width,
        anchor.height,
        reference.offsetWidth,
        reference.offsetHeight,
        floating.offsetWidth,
        floating.offsetHeight,
        floating.clientWidth,
        floating.clientHeight,
        floating.scrollWidth,
        floating.scrollHeight,
        root.clientWidth,
        root.clientHeight,
        document.body?.clientWidth,
        viewport?.width,
        viewport?.height,
        viewport?.scale,
        viewport?.offsetLeft,
        viewport?.offsetTop,
        authoredPositionStyle(floating),
        ancestors,
        intrinsicStyle,
      ]),
      overflowing:
        floating.scrollHeight > floating.clientHeight ||
        floating.scrollWidth > floating.clientWidth,
    };
  };
  let cache: { dimensions: Dimensions; revision: number; basis: ReturnType<typeof basis> } | null =
    null;
  return {
    begin(reuse: boolean) {
      mutations(observer?.takeRecords() ?? []);
      const current = basis();
      const previous = cache;
      const dimensions =
        reuse &&
        observer &&
        !disposed &&
        document.fonts?.status !== 'loading' &&
        previous?.revision === revision &&
        previous.basis.overflowing &&
        current.overflowing &&
        previous.basis.offsetParent === current.offsetParent &&
        previous.basis.values === current.values
          ? previous.dimensions
          : undefined;
      if (!dimensions) cache = null;
      trace(() => {
        const checks = {
          reuseRequested: reuse,
          mutationObserver: !!observer,
          active: !disposed,
          fontsReady: document.fonts?.status !== 'loading',
          cached: !!previous,
          sameRevision: previous?.revision === revision,
          previouslyOverflowing: previous?.basis.overflowing === true,
          currentlyOverflowing: current.overflowing,
          sameOffsetParent: previous?.basis.offsetParent === current.offsetParent,
          sameBasis: previous?.basis.values === current.values,
        };
        return {
          phase: 'intrinsic-begin',
          reused: !!dimensions,
          revision,
          cachedRevision: previous?.revision ?? null,
          checks,
          rejected: Object.entries(checks)
            .filter(([, passed]) => !passed)
            .map(([name]) => name),
          differences: basisDifferences(previous?.basis.values, current.values),
          dimensions: dimensions ?? null,
        };
      });
      return { dimensions, revision, authored: authoredPositionStyle(floating), basis: current };
    },
    measurementContext() {
      const current = basis();
      return { context: current.context, offsetParent: current.offsetParent };
    },
    projected(side: string, align: string) {
      projectedSide = side;
      projectedAlign = align;
    },
    commit(
      dimensions: Dimensions | undefined,
      input: { revision: number; authored: string; basis: ReturnType<typeof basis> },
      measuredUnder: { context: string; offsetParent: Element | null } | undefined
    ) {
      mutations(observer?.takeRecords() ?? []);
      const current = basis();
      if (
        !disposed &&
        dimensions &&
        measuredUnder &&
        measuredUnder.context === current.context &&
        measuredUnder.offsetParent === current.offsetParent &&
        input.revision === revision &&
        input.authored === authoredPositionStyle(floating) &&
        input.basis.intrinsicStyle === current.intrinsicStyle &&
        input.basis.scrollWidth === current.scrollWidth &&
        input.basis.scrollHeight === current.scrollHeight
      )
        cache = { dimensions, revision, basis: current };
      else cache = null;
      trace(() => {
        const checks = {
          active: !disposed,
          measuredDimensions: !!dimensions,
          measuredContext: !!measuredUnder,
          sameMeasurementContext: measuredUnder?.context === current.context,
          sameOffsetParent: measuredUnder?.offsetParent === current.offsetParent,
          sameRevision: input.revision === revision,
          sameAuthoredStyle: input.authored === authoredPositionStyle(floating),
          sameIntrinsicStyle: input.basis.intrinsicStyle === current.intrinsicStyle,
          sameScrollWidth: input.basis.scrollWidth === current.scrollWidth,
          sameScrollHeight: input.basis.scrollHeight === current.scrollHeight,
        };
        return {
          phase: 'intrinsic-commit',
          certified: !!cache,
          revision,
          inputRevision: input.revision,
          checks,
          rejected: Object.entries(checks)
            .filter(([, passed]) => !passed)
            .map(([name]) => name),
          differences: basisDifferences(input.basis.values, current.values),
          measurementContext: measuredUnder?.context ?? null,
          currentContext: current.context,
          dimensions: dimensions ?? null,
        };
      });
    },
    dispose() {
      disposed = true;
      cache = null;
      observer?.disconnect();
      floating.removeEventListener('load', externalInvalidation, true);
      document.fonts?.removeEventListener('loadingdone', externalInvalidation);
      document.fonts?.removeEventListener('loadingerror', externalInvalidation);
    },
  };
}

/** Only the first rect measurement uses natural size; size() must read the real capped box. */
function intrinsicPlatform(
  initial: Dimensions | undefined,
  beforeMeasurement: () => void,
  measured: (size: Dimensions) => void
): Platform {
  let first = true;
  return {
    ...domPlatform,
    async getElementRects(input) {
      if (first) beforeMeasurement();
      const rects = await domPlatform.getElementRects.call(this, input);
      if (!first) return rects;
      first = false;
      const dimensions = initial ?? { width: rects.floating.width, height: rects.floating.height };
      measured(dimensions);
      return { ...rects, floating: { ...rects.floating, ...dimensions } };
    },
  };
}

/**
 * Anchored geometry may exclude the anchor's own CSS translation. Interaction
 * transforms (hover lift, press-down) are decoration of the anchor surface;
 * when the consumer opts in via `excludeAnchorTranslation`, anchored surfaces
 * track layout position instead of the rendered surface. By default the host
 * measures the anchor's actual rendered geometry, so legitimate translations
 * (centering, application animation) keep floating placement where the user
 * sees the anchor.
 */
function virtualReferenceFor(anchor: HTMLElement) {
  return {
    getBoundingClientRect(): DOMRect {
      const rect = anchor.getBoundingClientRect();
      const shift = ownAnchorTranslation(anchor);
      return {
        x: rect.x - shift.x,
        y: rect.y - shift.y,
        left: rect.left - shift.x,
        top: rect.top - shift.y,
        right: rect.right - shift.x,
        bottom: rect.bottom - shift.y,
        width: rect.width,
        height: rect.height,
        toJSON: () => ({}),
      } as DOMRect;
    },
  };
}

/**
 * The anchor's own paint translation, not an ancestor's. `transform` matrices
 * do not include the independent CSS `translate` property, which still shifts
 * `getBoundingClientRect` and would otherwise move the popper basis.
 */
function ownAnchorTranslation(anchor: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (typeof getComputedStyle !== 'function') return { x, y };
  const style = getComputedStyle(anchor);
  const transform = style.transform;
  if (transform && transform !== 'none' && typeof DOMMatrixReadOnly !== 'undefined') {
    const matrix = new DOMMatrixReadOnly(transform);
    x += matrix.m41;
    y += matrix.m42;
  }
  const translate = style.translate;
  if (translate && translate !== 'none') {
    const [tx, ty] = translate.trim().split(/\s+/);
    x += cssLengthToPx(tx, rectBasis(anchor, 'x'));
    y += cssLengthToPx(ty ?? '0px', rectBasis(anchor, 'y'));
  }
  return { x, y };
}

function rectBasis(anchor: HTMLElement, axis: 'x' | 'y'): number {
  const rect = anchor.getBoundingClientRect();
  return axis === 'x' ? rect.width : rect.height;
}

function cssLengthToPx(value: string | undefined, basis: number): number {
  if (!value) return 0;
  const text = value.trim();
  if (!text || text === 'none') return 0;
  if (text.endsWith('%')) {
    const percent = Number.parseFloat(text);
    return Number.isFinite(percent) ? (percent / 100) * basis : 0;
  }
  const pixels = Number.parseFloat(text);
  return Number.isFinite(pixels) ? pixels : 0;
}

function positionReference(anchor: HTMLElement, config: AnchoredPositionConfig) {
  return config.excludeAnchorTranslation === true ? virtualReferenceFor(anchor) : anchor;
}

function middlewareFor(
  config: AnchoredPositionConfig,
  isCurrent: () => boolean,
  projected: ReturnType<typeof ownStyles>,
  available?: (width: number, height: number) => void
): Middleware[] {
  const middleware: Middleware[] = [
    offset({ mainAxis: config.sideOffset, crossAxis: config.alignOffset }),
  ];
  const boundary = config.collisionBoundary === 'viewport' ? [] : 'clippingAncestors';
  if (config.avoidCollisions) {
    middleware.push(
      flip({ boundary, rootBoundary: 'viewport', padding: config.collisionPadding }),
      shift({ boundary, rootBoundary: 'viewport', padding: config.collisionPadding })
    );
  }
  middleware.push(
    size({
      boundary,
      rootBoundary: 'viewport',
      padding: config.collisionPadding,
      apply({ availableWidth, availableHeight, rects }) {
        if (!isCurrent()) return;
        available?.(availableWidth, availableHeight);
        if (!isCurrent()) return;
        for (const [name, value] of [
          ['--proto-ui-anchor-width', `${rects.reference.width}px`],
          ['--proto-ui-anchor-height', `${rects.reference.height}px`],
          ['--proto-ui-available-width', `${availableWidth}px`],
          ['--proto-ui-available-height', `${availableHeight}px`],
        ]) {
          if (!isCurrent()) return;
          if (!projected.write(name, value)) return;
        }
      },
    })
  );
  return middleware;
}

/** Edge placement and used-box sizing share a lifetime, not a component policy. */
function createEdgeSizeLease(connection: AnchoredPositionConnection, current: () => boolean) {
  const descriptor = connection.sizeMatch!;
  const frame = connection.floating;
  const reference = descriptor.reference;
  const targets = descriptor.targets;
  const complete = isElement(frame) && isElement(reference) && targets.every(isElement);
  const valid =
    !connection.targetAlignment &&
    complete &&
    reference === connection.anchor &&
    targets.length > 0 &&
    targets.every(isElement) &&
    new Set(targets).size === targets.length &&
    targets.every(
      (target) =>
        frame.contains(target as HTMLElement) &&
        target !== frame &&
        (target as HTMLElement).ownerDocument === frame.ownerDocument
    ) &&
    reference.ownerDocument === frame.ownerDocument;
  const missing = frame == null || reference == null || targets.some((target) => target == null);
  let terminal: TargetAlignmentStatus | null = valid
    ? null
    : missing
      ? { status: 'pending-target', reason: 'missing-target' }
      : { status: 'unavailable', reason: 'invalid-association' };
  const sizeLease = valid
    ? createBorderBoxSizeLease(reference, targets as HTMLElement[], current)
    : null;
  const frameStyle = valid ? ownStyles(frame) : null;
  let wroteWidth = false;
  let minimum = 0;
  const fail = (
    reason: 'invalid-geometry' | 'ownership-lost' | 'size-conflict'
  ): TargetAlignmentStatus => {
    sizeLease?.abort(reason);
    frameStyle?.restore();
    terminal = { status: 'unavailable', reason };
    return terminal;
  };
  const convert = (
    result: Exclude<ReturnType<NonNullable<typeof sizeLease>['prepare']>, { kind: 'prepared' }>
  ): TargetAlignmentStatus => {
    if (result.kind === 'pending') return { status: 'pending-target', reason: 'missing-target' };
    if (result.reason === 'detached-target') {
      return { status: 'pending-target', reason: 'detached-target' };
    }
    return fail(result.reason);
  };
  return {
    observed: valid ? [reference, frame, ...(targets as HTMLElement[])] : [],
    prepare(): TargetAlignmentStatus | { width: number; height: number } {
      if (terminal) return terminal;
      if (!current() || !isElement(frame) || !sizeLease || !frameStyle)
        return { status: 'pending-target', reason: 'detached-target' };
      if (!frameStyle.isCurrent()) return fail('ownership-lost');
      const prepared = sizeLease.prepare();
      if (prepared.kind !== 'prepared') return convert(prepared);
      const gutters = (targets as HTMLElement[]).map((target) =>
        measureBorderBoxInlineGutter(target, frame)
      );
      if (gutters.some((gutter) => gutter === null)) return fail('invalid-geometry');
      minimum = prepared.width + Math.max(...(gutters as number[]));
      if (!current()) return { status: 'pending-target', reason: 'detached-target' };
      const frameWidth = frame.offsetWidth;
      if (!current()) return { status: 'pending-target', reason: 'detached-target' };
      if (wroteWidth || frameWidth < minimum) {
        // Preserve authored sizing. CSS resolves min/max constraints; verify()
        // certifies the used box instead of a minimum overriding an author cap.
        if (
          !wroteWidth &&
          ((frame.style.getPropertyValue('width') && !hasOwnedStyle(frame, 'width')) ||
            (frame.style.getPropertyValue('inline-size') && !hasOwnedStyle(frame, 'inline-size')))
        )
          return fail('size-conflict');
        const style = frame.ownerDocument.defaultView?.getComputedStyle(frame);
        if (!style) return fail('invalid-geometry');
        const chrome =
          style.boxSizing === 'border-box'
            ? 0
            : Number.parseFloat(style.paddingLeft) +
              Number.parseFloat(style.paddingRight) +
              Number.parseFloat(style.borderLeftWidth) +
              Number.parseFloat(style.borderRightWidth);
        const width = minimum - chrome;
        if (!Number.isFinite(width) || chrome < 0) return fail('invalid-geometry');
        if (width <= 0) return fail('size-conflict');
        if (!frameStyle.write('width', `${width}px`)) return fail('ownership-lost');
        wroteWidth = true;
      }
      return { width: prepared.width, height: prepared.height };
    },
    verify(
      available: { width: number; height: number } | null
    ): TargetAlignmentStatus | { status: 'reference-changed' } {
      if (terminal) return terminal;
      if (!current() || !isElement(frame) || !sizeLease || !frameStyle)
        return { status: 'pending-target', reason: 'detached-target' };
      if (!frameStyle.isCurrent()) return fail('ownership-lost');
      const verified = sizeLease.verify();
      if (verified.kind === 'reference-changed') return { status: 'reference-changed' };
      if (verified.kind !== 'matched') return convert(verified);
      if (!Number.isFinite(frame.offsetWidth) || !Number.isFinite(frame.offsetHeight))
        return fail('invalid-geometry');
      if (frame.offsetWidth <= 0 || frame.offsetHeight <= 0)
        return { status: 'pending-target', reason: 'missing-target' };
      if (
        frame.offsetWidth + 1 < minimum ||
        (available &&
          (frame.offsetWidth > available.width + 1 || frame.offsetHeight > available.height + 1))
      )
        return fail('size-conflict');
      for (const target of targets as HTMLElement[]) {
        const clipped = hasBorderBoxInlineClipping(target, frame);
        if (clipped !== false) return fail(clipped === null ? 'invalid-geometry' : 'size-conflict');
      }
      return { status: 'applied' };
    },
    fail,
    dispose() {
      sizeLease?.restore();
      frameStyle?.restore();
    },
  };
}

// computePosition yields before writing coordinates. A portaled custom element
// is still in normal flow at the end of the document during that gap, and WC
// entry focus scrolls it into view even when preventScroll is requested. The
// later fixed coordinates are then solved against the scrolled anchor and stay
// outside the viewport. Pin the configured strategy inside the viewport before
// the first await so focus cannot move the document.
function pinAnchoredStrategy(
  floating: HTMLElement,
  strategy: string,
  styles: ReturnType<typeof ownStyles>
) {
  // Preparation is still an owned geometry write. An equal value held by a
  // prior lease must transfer ownership so its retirement cannot erase us.
  if (floating.style.position !== strategy || hasOwnedStyle(floating, 'position'))
    styles.write('position', strategy);
  for (const name of ['top', 'left'] as const) {
    if (floating.style[name] === '' || hasOwnedStyle(floating, name))
      styles.write(name, floating.style[name] || '0px');
  }
}

function createEdgeAnchoredPositionHost(): AnchoredPositionHost {
  return {
    attach(initial): AnchoredPositionHostLease {
      let connection = initial;
      let disposed = false;
      let generation = 0;
      let cleanup: (() => void) | null = null;
      let sizingEpoch = 0;
      let sizing: ReturnType<typeof createEdgeSizeLease> | null = null;
      let sizeObservers: ResizeObserver[] = [];
      let strategyPin: { target: HTMLElement; styles: ReturnType<typeof ownStyles> } | null = null;
      let projectedSize: ReturnType<typeof ownStyles> | null = null;
      let projectedSizeTarget: HTMLElement | null = null;
      let scrollObservation: ReturnType<typeof observePositionScroll> | null = null;
      let intrinsicObservation: ReturnType<typeof observeIntrinsicSize> | null = null;
      const traceLease = {};
      let traceClosed = false;
      const trace = (target: unknown, details: () => Record<string, unknown>) => {
        if (traceClosed || !isElement(target)) return;
        try {
          const sink = decisionSink(target);
          if (typeof sink === 'function')
            sink(target, traceLease, () => ({ generation, ...details() }));
        } catch {
          // A diagnostic consumer must never change the lease's control flow.
        }
      };
      const retireProjectedSize = (reason: string) => {
        const previous = projectedSize;
        const target = projectedSizeTarget;
        if (previous && target)
          trace(target, () => ({
            phase: 'retire-projected-size',
            reason,
            availableWidth: target.style.getPropertyValue('--proto-ui-available-width'),
            availableHeight: target.style.getPropertyValue('--proto-ui-available-height'),
            currentOwner: previous.isCurrent(),
            stack: new Error('Positioning cap retirement').stack,
          }));
        projectedSize = null;
        projectedSizeTarget = null;
        previous?.restore();
      };
      const retireStrategyPin = () => {
        const previous = strategyPin;
        strategyPin = null;
        previous?.styles.restore();
      };
      const retireSizing = () => {
        sizingEpoch++;
        for (const observer of sizeObservers) observer.disconnect();
        sizeObservers = [];
        const previous = sizing;
        sizing = null;
        previous?.dispose();
      };
      const referenceFor = (anchor: unknown, config: AnchoredPositionConfig) => {
        if (isElement(anchor))
          return {
            element: anchor,
            reference: positionReference(anchor, config),
            isLive: () => true,
          };
        return resolveWebInputOriginAnchor(anchor);
      };

      const position = async (reuseIntrinsic = false, reason = 'internal') => {
        const current = connection;
        const { anchor, floating, config } = current;
        const version = ++generation;
        const reference = referenceFor(anchor, config);
        const isCurrent = () =>
          !disposed &&
          version === generation &&
          !!reference?.isLive() &&
          (!projectedSize || projectedSize.isCurrent()) &&
          (!strategyPin || strategyPin.styles.isCurrent());
        trace(floating, () => ({
          phase: 'position',
          reason,
          reuseRequested: reuseIntrinsic,
          hasProjection: !!projectedSize,
          currentProjection: projectedSize?.isCurrent() ?? null,
          hasIntrinsicObservation: !!intrinsicObservation,
          sizeMatch: !!current.sizeMatch,
          config: { ...config },
        }));
        if (disposed) return;
        if (!reference || !isElement(floating)) {
          if (current.sizeMatch && version === generation) {
            const ownSizing = sizing;
            const prepared = ownSizing?.prepare();
            if (!disposed && version === generation && ownSizing === sizing)
              current.onSizeMatch?.(
                prepared && 'status' in prepared
                  ? prepared
                  : { status: 'pending-target', reason: 'missing-target' }
              );
          }
          return;
        }
        scrollObservation?.refresh();
        const ownIntrinsic = intrinsicObservation;
        const intrinsicInput = ownIntrinsic?.begin(
          reuseIntrinsic && !!projectedSize?.isCurrent() && !current.sizeMatch
        );
        let naturalDimensions = intrinsicInput?.dimensions;
        let measurementContext:
          | ReturnType<NonNullable<typeof ownIntrinsic>['measurementContext']>
          | undefined;
        // Available-space variables are outputs of the last solve. Measuring
        // through that cap can make an overflowing preferred side appear to
        // fit forever after content/font/viewport changes. Release only our
        // claims before measuring intrinsic geometry; authored values and any
        // replacement owner's writes remain intact. Each solve then owns a
        // fresh projection, guarded by the existing computation generation.
        // Geometry-only refreshes may reuse independently measured natural
        // dimensions. Keeping the live cap avoids clamping native scrolling;
        // the first Floating UI rect read still sees the natural size for flip.
        if (!naturalDimensions) retireProjectedSize(`fresh:${reason}`);
        if (!isCurrent()) return;
        const ownProjection =
          naturalDimensions && projectedSize ? projectedSize : ownStyles(floating);
        projectedSize = ownProjection;
        projectedSizeTarget = floating;
        if (!strategyPin || strategyPin.target !== floating) {
          retireStrategyPin();
          if (!isCurrent()) return;
          strategyPin = { target: floating, styles: ownStyles(floating) };
        }
        pinAnchoredStrategy(floating, config.strategy, strategyPin.styles);
        if (!isCurrent()) return;
        if (sizing) {
          const ownSizing = sizing;
          for (let pass = 0; pass < 4; pass++) {
            if (!isCurrent() || ownSizing !== sizing) return;
            const prepared = ownSizing.prepare();
            if ('status' in prepared) {
              if (isCurrent()) current.onSizeMatch?.(prepared);
              return;
            }
            let available: { width: number; height: number } | null = null;
            let result: Awaited<ReturnType<typeof computePosition>>;
            try {
              result = await computePosition(reference.reference, floating, {
                placement: toPlacement(config),
                strategy: config.strategy,
                middleware: middlewareFor(config, isCurrent, ownProjection, (width, height) => {
                  available = { width, height };
                }),
              });
            } catch (error) {
              if (isCurrent() && ownSizing === sizing)
                current.onSizeMatch?.(ownSizing.fail('invalid-geometry'));
              return;
            }
            if (!isCurrent() || ownSizing !== sizing) return;
            const verified = ownSizing.verify(available);
            if (verified.status === 'reference-changed') continue;
            if (verified.status !== 'applied') {
              if (isCurrent()) current.onSizeMatch?.(verified);
              return;
            }
            // A completed solve replaces the temporary preparation. Restore
            // its original fields before publishing coordinates synchronously;
            // later disposal must not undo an already resolved placement.
            retireStrategyPin();
            for (const [name, value] of [
              ['position', result.strategy],
              ['left', `${result.x}px`],
              ['top', `${result.y}px`],
            ]) {
              if (!isCurrent() || ownSizing !== sizing) return;
              floating.style.setProperty(name, value);
            }
            const resolved = fromPlacement(result.placement);
            if (!isCurrent() || ownSizing !== sizing) return;
            floating.dataset.side = resolved.side;
            if (!isCurrent() || ownSizing !== sizing) return;
            floating.dataset.align = resolved.align;
            if (!isCurrent() || ownSizing !== sizing) return;
            // Installing fixed/absolute placement may itself alter containing
            // layout. Certify the resulting used boxes, not only the solve input.
            const placed = ownSizing.verify(available);
            if (placed.status === 'reference-changed') continue;
            if (placed.status !== 'applied') {
              if (isCurrent()) current.onSizeMatch?.(placed);
              return;
            }
            current.onResolved?.({ ...resolved, strategy: result.strategy });
            if (!isCurrent() || ownSizing !== sizing) return;
            // The resolved callback is a reentrant owner boundary too.
            const delivered = ownSizing.verify(available);
            if (delivered.status === 'reference-changed') continue;
            if (isCurrent() && ownSizing === sizing) current.onSizeMatch?.(delivered);
            return;
          }
          if (isCurrent() && ownSizing === sizing)
            current.onSizeMatch?.(ownSizing.fail('invalid-geometry'));
          return;
        }
        const result = await computePosition(reference.reference, floating, {
          placement: toPlacement(config),
          strategy: config.strategy,
          middleware: middlewareFor(config, isCurrent, ownProjection),
          ...(ownIntrinsic
            ? {
                platform: intrinsicPlatform(
                  naturalDimensions,
                  () => {
                    measurementContext = ownIntrinsic.measurementContext();
                  },
                  (measured) => {
                    naturalDimensions = measured;
                  }
                ),
              }
            : {}),
        });
        if (!isCurrent()) {
          trace(floating, () => ({ phase: 'position-stale', solve: version, reason }));
          return;
        }
        retireStrategyPin();
        if (!isCurrent()) return;
        Object.assign(floating.style, {
          position: result.strategy,
          left: `${result.x}px`,
          top: `${result.y}px`,
        });
        const resolved = fromPlacement(result.placement);
        ownIntrinsic?.projected(resolved.side, resolved.align);
        floating.dataset.side = resolved.side;
        floating.dataset.align = resolved.align;
        if (isCurrent() && ownIntrinsic === intrinsicObservation && intrinsicInput)
          ownIntrinsic?.commit(naturalDimensions, intrinsicInput, measurementContext);
        current.onResolved?.({ ...resolved, strategy: result.strategy });
      };

      const restart = () => {
        cleanup?.();
        cleanup = null;
        retireSizing();
        retireStrategyPin();
        retireProjectedSize('restart');
        if (connection.sizeMatch) {
          const epoch = sizingEpoch;
          sizing = createEdgeSizeLease(connection, () => !disposed && epoch === sizingEpoch);
          const view = isElement(connection.floating)
            ? connection.floating.ownerDocument.defaultView
            : null;
          if (typeof view?.ResizeObserver === 'function') {
            // A target retains one box registration per observer, not two.
            sizeObservers = (['content-box', 'border-box'] as const).map((box) => {
              const observer = new view.ResizeObserver(() => {
                if (!disposed && epoch === sizingEpoch) void position(false, 'size-observer');
              });
              for (const target of sizing!.observed) observer.observe(target, { box });
              return observer;
            });
          }
        }
        const { anchor, floating } = connection;
        const reference = referenceFor(anchor, connection.config);
        if (!reference || !isElement(floating)) {
          if (connection.sizeMatch) void position(false, 'restart-missing-target');
          return;
        }
        const ownIntrinsic = connection.sizeMatch
          ? null
          : observeIntrinsicSize(reference.element, floating, (details) =>
              trace(floating, details)
            );
        intrinsicObservation = ownIntrinsic;
        const stopAuto = autoUpdate(
          reference.reference,
          floating,
          () => {
            void position(true, 'autoUpdate');
          },
          {
            animationFrame: false,
          }
        );
        const stopRoot = observeRootSpace(reference.element.ownerDocument, () => {
          void position(false, 'root-space');
        });
        // autoUpdate records overflow ancestors only once. A scroller that
        // becomes overflow:auto after the popup opens (nested demo panes)
        // never notifies that list, so the fixed popper keeps its pre-scroll
        // coordinates. Capture only scrolls that can move this reference or
        // floating box. Re-solving for its own content scroll would briefly
        // release the available-size cap and clamp its native scroll offset.
        // Native scroll is not composed, so observe the relevant shadow roots
        // as well as the document; a composed event is handled only once.
        const ownScroll = observePositionScroll(reference.element, floating, () => {
          void position(true, 'captured-scroll');
        });
        scrollObservation = ownScroll;
        const stopInvalidation = resolveWebInputOriginAnchor(anchor)?.subscribeInvalidation(() => {
          generation++;
          retireSizing();
          retireStrategyPin();
          retireProjectedSize('input-origin-invalidation');
          cleanup?.();
          cleanup = null;
        });
        cleanup = () => {
          stopAuto();
          stopRoot();
          stopInvalidation?.();
          ownScroll.dispose();
          if (scrollObservation === ownScroll) scrollObservation = null;
          ownIntrinsic?.dispose();
          if (intrinsicObservation === ownIntrinsic) intrinsicObservation = null;
        };
      };

      restart();

      return {
        update(next) {
          if (disposed) return;
          generation += 1;
          const sameConfig = (
            Object.keys({ ...connection.config, ...next.config }) as Array<
              keyof AnchoredPositionConfig
            >
          ).every((key) =>
            key === 'excludeAnchorTranslation'
              ? (connection.config[key] === true) === (next.config[key] === true)
              : Object.is(connection.config[key], next.config[key])
          );
          const targetsChanged =
            !Object.is(connection.anchor, next.anchor) ||
            !Object.is(connection.floating, next.floating) ||
            Boolean(connection.targetAlignment) !== Boolean(next.targetAlignment) ||
            Boolean(connection.sizeMatch) !== Boolean(next.sizeMatch) ||
            (!!connection.sizeMatch &&
              !!next.sizeMatch &&
              (connection.sizeMatch.reference !== next.sizeMatch.reference ||
                connection.sizeMatch.targets.length !== next.sizeMatch.targets.length ||
                connection.sizeMatch.targets.some(
                  (target, index) => target !== next.sizeMatch!.targets[index]
                )));
          connection = next;
          // A new explicit sizing connection is a new owner generation even
          // when its element identities stay equal. Reentrant config/status
          // handoffs must not leave the prior synchronous size writer current.
          if (targetsChanged || next.sizeMatch) restart();
          else
            void position(sameConfig, sameConfig ? 'equivalent-update' : 'changed-config-update');
        },
        requestUpdate() {
          void position(false, 'requestUpdate');
        },
        dispose() {
          disposed = true;
          generation += 1;
          trace(connection.floating, () => ({ phase: 'dispose' }));
          retireSizing();
          retireStrategyPin();
          retireProjectedSize('dispose');
          cleanup?.();
          cleanup = null;
          traceClosed = true;
        },
      };
    },
  };
}

/** Both policies share one host capability; the descriptor selects geometry, not a component. */
export function createFloatingUiAnchoredPositionHost(): AnchoredPositionHost {
  const edge = createEdgeAnchoredPositionHost();
  return {
    supportsTargetAlignment: true,
    supportsSizeMatch: true,
    attach(initial) {
      let connection = initial;
      let disposed = false;
      const acquire = (next: AnchoredPositionConnection) =>
        next.targetAlignment && !next.sizeMatch
          ? createTargetAlignmentLease(next)
          : edge.attach(next);
      let lease: ReturnType<typeof acquire> | null = acquire(initial);
      let generation = 0;
      return {
        update(next) {
          if (disposed) return;
          const changed =
            Boolean(connection.targetAlignment && !connection.sizeMatch) !==
            Boolean(next.targetAlignment && !next.sizeMatch);
          connection = next;
          if (!changed && lease) {
            lease.update(next);
            return;
          }
          const request = ++generation;
          const previous = lease;
          lease = null;
          previous?.dispose();
          if (disposed || request !== generation || connection !== next) return;
          const acquired = acquire(next);
          if (disposed || request !== generation || connection !== next) acquired.dispose();
          else lease = acquired;
        },
        requestUpdate() {
          if (!disposed) lease?.requestUpdate();
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          generation++;
          const previous = lease;
          lease = null;
          previous?.dispose();
        },
      };
    },
  };
}
