import { createTargetAlignmentLease } from './target-alignment-host';
import { resolveWebInputOriginAnchor } from './input-origin-anchor';
import { observeRootSpace } from './root-space-observer';
import { createBorderBoxSizeLease, measureBorderBoxInlineGutter } from './border-box-size-lease';
import { ownStyles, hasOwnedStyle } from './owned-style-lease';
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
  type Middleware,
  type Placement,
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
      let dx = 0;
      let dy = 0;
      const transform =
        typeof getComputedStyle === 'function' ? getComputedStyle(anchor).transform : 'none';
      if (transform && transform !== 'none' && typeof DOMMatrixReadOnly !== 'undefined') {
        const matrix = new DOMMatrixReadOnly(transform);
        dx = matrix.m41;
        dy = matrix.m42;
      }
      return {
        x: rect.x - dx,
        y: rect.y - dy,
        left: rect.left - dx,
        top: rect.top - dy,
        right: rect.right - dx,
        bottom: rect.bottom - dy,
        width: rect.width,
        height: rect.height,
        toJSON: () => ({}),
      } as DOMRect;
    },
  };
}

function positionReference(anchor: HTMLElement, config: AnchoredPositionConfig) {
  return config.excludeAnchorTranslation === true ? virtualReferenceFor(anchor) : anchor;
}

function middlewareFor(
  config: AnchoredPositionConfig,
  isCurrent: () => boolean,
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
      apply({ availableWidth, availableHeight, rects, elements }) {
        if (!isCurrent()) return;
        available?.(availableWidth, availableHeight);
        if (!isCurrent()) return;
        const style = elements.floating.style;
        for (const [name, value] of [
          ['--proto-ui-anchor-width', `${rects.reference.width}px`],
          ['--proto-ui-anchor-height', `${rects.reference.height}px`],
          ['--proto-ui-available-width', `${availableWidth}px`],
          ['--proto-ui-available-height', `${availableHeight}px`],
        ]) {
          if (!isCurrent()) return;
          style.setProperty(name, value);
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
      frameStyle?.restore();
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
      return { status: 'applied' };
    },
    fail,
    dispose() {
      sizeLease?.restore();
      frameStyle?.restore();
    },
  };
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
      let sizeObserver: ResizeObserver | null = null;
      const retireSizing = () => {
        sizingEpoch++;
        sizeObserver?.disconnect();
        sizeObserver = null;
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

      const position = async () => {
        const current = connection;
        const { anchor, floating, config } = current;
        const version = ++generation;
        const reference = referenceFor(anchor, config);
        const isCurrent = () => !disposed && version === generation && !!reference?.isLive();
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
                middleware: middlewareFor(config, isCurrent, (width, height) => {
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
          middleware: middlewareFor(config, isCurrent),
        });
        if (!isCurrent()) return;
        Object.assign(floating.style, {
          position: result.strategy,
          left: `${result.x}px`,
          top: `${result.y}px`,
        });
        const resolved = fromPlacement(result.placement);
        floating.dataset.side = resolved.side;
        floating.dataset.align = resolved.align;
        current.onResolved?.({ ...resolved, strategy: result.strategy });
      };

      const restart = () => {
        cleanup?.();
        cleanup = null;
        retireSizing();
        if (connection.sizeMatch) {
          const epoch = sizingEpoch;
          sizing = createEdgeSizeLease(connection, () => !disposed && epoch === sizingEpoch);
          const view = isElement(connection.floating)
            ? connection.floating.ownerDocument.defaultView
            : null;
          if (typeof view?.ResizeObserver === 'function') {
            sizeObserver = new view.ResizeObserver(() => {
              if (!disposed && epoch === sizingEpoch) void position();
            });
            for (const target of sizing.observed)
              sizeObserver.observe(target, { box: 'border-box' });
          }
        }
        const { anchor, floating } = connection;
        const reference = referenceFor(anchor, connection.config);
        if (!reference || !isElement(floating)) {
          if (connection.sizeMatch) void position();
          return;
        }
        const stopAuto = autoUpdate(reference.reference, floating, position, {
          animationFrame: false,
        });
        const stopRoot = observeRootSpace(reference.element.ownerDocument, () => {
          void position();
        });
        const stopInvalidation = resolveWebInputOriginAnchor(anchor)?.subscribeInvalidation(() => {
          generation++;
          retireSizing();
          cleanup?.();
          cleanup = null;
        });
        cleanup = () => {
          stopAuto();
          stopRoot();
          stopInvalidation?.();
        };
      };

      restart();

      return {
        update(next) {
          if (disposed) return;
          generation += 1;
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
          else void position();
        },
        requestUpdate() {
          void position();
        },
        dispose() {
          disposed = true;
          generation += 1;
          retireSizing();
          cleanup?.();
          cleanup = null;
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
