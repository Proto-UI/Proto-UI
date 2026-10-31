import { ownStyles } from './owned-style-lease';
import { createBorderBoxSizeLease, measureBorderBoxInlineGutter } from './border-box-size-lease';
import type {
  AnchoredPositionConnection,
  TargetAlignmentConnection,
  TargetAlignmentStatus,
} from '@proto.ui/core';
import type { AnchoredPositionHostLease } from '../caps';
import {
  reduceScrollExpansion,
  solveTargetAlignment,
  type TargetAlignmentPlan,
} from '../geometry/target-alignment';

const element = (value: unknown): value is HTMLElement =>
  !!value &&
  typeof value === 'object' &&
  (value as Node).nodeType === 1 &&
  typeof (value as HTMLElement).getBoundingClientRect === 'function' &&
  'style' in value;

/** Unscrolled layout offset, independent of transforms and intervening positioned ancestors. */
function layoutTop(node: HTMLElement): number {
  let top = 0;
  let current: HTMLElement | null = node;
  while (current) {
    top += current.offsetTop;
    const parent: Element | null = current.offsetParent;
    if (!element(parent)) break;
    top += parent.clientTop;
    current = parent;
  }
  return top;
}
const relativeTop = (node: HTMLElement, ancestor: HTMLElement) =>
  layoutTop(node) - layoutTop(ancestor) - ancestor.clientTop;

function layoutLeft(node: HTMLElement): number {
  let left = 0;
  let current: HTMLElement | null = node;
  while (current) {
    left += current.offsetLeft;
    const parent: Element | null = current.offsetParent;
    if (!element(parent)) break;
    left += parent.clientLeft;
    current = parent;
  }
  for (let parent = node.parentElement; parent; parent = parent.parentElement)
    left -= parent.scrollLeft;
  return left;
}

type Targets = {
  [K in
    | 'surface'
    | 'scrollport'
    | 'blockReference'
    | 'inlineReference'
    | 'blockTarget'
    | 'inlineTarget']: HTMLElement;
};

function sameGeometry(a: AnchoredPositionConnection, b: AnchoredPositionConnection): boolean {
  const x = a.targetAlignment,
    y = b.targetAlignment;
  if (!x || !y || a.floating !== b.floating) return false;
  const sameSize =
    (!x.sizeMatch && !y.sizeMatch) ||
    (!!x.sizeMatch &&
      !!y.sizeMatch &&
      x.sizeMatch.reference === y.sizeMatch.reference &&
      x.sizeMatch.targets.length === y.sizeMatch.targets.length &&
      x.sizeMatch.targets.every((target, index) => target === y.sizeMatch?.targets[index]));
  return (
    sameSize &&
    (
      [
        'surface',
        'scrollport',
        'blockReference',
        'inlineReference',
        'blockTarget',
        'inlineTarget',
        'atStart',
        'atEnd',
      ] as const
    ).every((key) => x[key] === y[key]) &&
    (
      ['boundary', 'margin', 'minimumTargetSpanCount', 'inlineOverflow', 'expandOnScroll'] as const
    ).every((key) => x.constraints[key] === y.constraints[key])
  );
}

export function createTargetAlignmentLease(
  initial: AnchoredPositionConnection
): AnchoredPositionHostLease {
  let connection = initial;
  let disposed = false;
  let version = 0;
  let lastStatus: TargetAlignmentStatus | null = null;
  let stop: (() => void) | null = null;
  let restore: (() => void) | null = null;
  let updateGeometry: (() => void) | null = null;

  const retire = () => {
    stop?.();
    stop = null;
    updateGeometry = null;
    restore?.();
    restore = null;
  };
  const start = () => {
    const current = connection;
    const request = ++version;
    lastStatus = null;
    retire();
    const live = () => !disposed && version === request;
    const report = (status: TargetAlignmentStatus) => {
      if (live()) {
        lastStatus = status;
        connection.onAlignment?.(status);
      }
    };
    const descriptor = current.targetAlignment;
    if (!descriptor || !element(current.floating)) {
      report({ status: 'pending-target', reason: 'missing-target' });
      return;
    }
    const keys = [
      'surface',
      'scrollport',
      'blockReference',
      'inlineReference',
      'blockTarget',
      'inlineTarget',
    ] as const;
    if (!keys.every((key) => element(descriptor[key]))) {
      report({ status: 'pending-target', reason: 'missing-target' });
      return;
    }
    const targets = descriptor as TargetAlignmentConnection & Targets;
    const frame = current.floating;
    const doc = frame.ownerDocument;
    const view = doc.defaultView;
    if (!view) {
      report({ status: 'pending-target', reason: 'detached-target' });
      return;
    }
    const sizing = descriptor.sizeMatch;
    if (
      sizing &&
      (!element(sizing.reference) || sizing.targets.length === 0 || !sizing.targets.every(element))
    ) {
      report({ status: 'pending-target', reason: 'missing-target' });
      return;
    }
    const sizeTargets = sizing ? (sizing.targets as readonly HTMLElement[]) : [];
    const sizeLease = sizing
      ? createBorderBoxSizeLease(sizing.reference as HTMLElement, sizeTargets, live)
      : null;
    const owned = ownStyles(frame);
    restore = () => {
      owned.restore();
      sizeLease?.restore();
    };
    let plan: TargetAlignmentPlan | null = null;
    let requestedSpan = 0;
    let previousScroll = targets.scrollport.scrollTop;
    let expand = false;
    let frameTask: number | null = null;
    let applied = false;
    let writing = false;
    let ownershipLost = false;
    const write = (name: string, value: string) => {
      if (!live() || ownershipLost) return false;
      if (!owned.write(name, value)) {
        ownershipLost = true;
        report({ status: 'unavailable', reason: 'ownership-lost' });
        return false;
      }
      return true;
    };
    const connected = () =>
      frame.isConnected &&
      keys.every((key) => targets[key].isConnected && targets[key].ownerDocument === doc) &&
      sizeTargets.every((target) => target.isConnected && target.ownerDocument === doc);
    const readPlan = (): TargetAlignmentPlan | null => {
      if (!live() || !connected()) {
        if (live()) report({ status: 'pending-target', reason: 'detached-target' });
        return null;
      }
      const reference = targets.blockReference.getBoundingClientRect();
      const value = targets.inlineReference.getBoundingClientRect();
      // Floating layout uses CSSOM offset precision, not the Surface's animated paint bounds.
      // Keep the neutral Frame origin and reference/value viewport fractions.
      const origin = frame.getBoundingClientRect().left - layoutLeft(frame);
      const surfaceLeft = origin + layoutLeft(targets.surface);
      const surfaceWidth = targets.surface.offsetWidth;
      const textLeft = origin + layoutLeft(targets.inlineTarget);
      if (targets.blockTarget.offsetHeight <= 0 || reference.height <= 0) {
        report({ status: 'pending-target', reason: 'missing-target' });
        return null;
      }
      const paint = view.getComputedStyle(targets.surface);
      const scroll = view.getComputedStyle(targets.scrollport);
      const css = (text: string) => Number.parseInt(text, 10);
      const gutters = sizeTargets.map((target) =>
        measureBorderBoxInlineGutter(target, targets.surface)
      );
      if (gutters.some((gutter) => gutter === null)) {
        report({ status: 'unavailable', reason: 'invalid-geometry' });
        return null;
      }
      const minimumOuterInlineSpan = sizeTargets.length
        ? (sizing?.reference as HTMLElement).offsetWidth + Math.max(...(gutters as number[]))
        : undefined;
      const result = solveTargetAlignment(
        {
          direction: view.getComputedStyle(frame).direction === 'rtl' ? 'rtl' : 'ltr',
          viewport: { width: view.innerWidth, height: view.innerHeight },
          reference: {
            left: reference.left,
            right: reference.right,
            top: reference.top,
            width: reference.width,
            height: reference.height,
            valueLeft: value.left,
            valueRight: value.right,
          },
          surface: {
            left: surfaceLeft,
            right: surfaceLeft + surfaceWidth,
            width: surfaceWidth,
            clientHeight: targets.surface.clientHeight,
            borderTop: css(paint.borderTopWidth),
            borderBottom: css(paint.borderBottomWidth),
            paddingTop: css(paint.paddingTop),
            paddingBottom: css(paint.paddingBottom),
          },
          target: {
            textLeft,
            textRight: textLeft + targets.inlineTarget.offsetWidth,
            offset: relativeTop(targets.blockTarget, targets.scrollport),
            height: targets.blockTarget.offsetHeight,
            atStart: descriptor.atStart,
            atEnd: descriptor.atEnd,
            ...(minimumOuterInlineSpan === undefined ? {} : { minimumOuterInlineSpan }),
          },
          scrollport: {
            scrollHeight: targets.scrollport.scrollHeight,
            offsetTop: relativeTop(targets.scrollport, targets.surface),
            height: targets.scrollport.offsetHeight,
            paddingTop: css(scroll.paddingTop),
            paddingBottom: css(scroll.paddingBottom),
          },
        },
        descriptor.constraints
      );
      if (!live()) return null;
      if (result.kind !== 'plan') {
        report({ status: 'unavailable', reason: 'invalid-geometry' });
        return null;
      }
      return result.plan;
    };
    const equivalent = (a: TargetAlignmentPlan, b: TargetAlignmentPlan) =>
      a.inline.edge === b.inline.edge &&
      a.block.pin === b.block.pin &&
      Math.abs(a.inline.inset - b.inline.inset) < 0.01 &&
      Math.abs(a.inline.minimumSpan - b.inline.minimumSpan) < 0.01 &&
      Math.abs(a.block.requestedSpan - b.block.requestedSpan) < 0.01 &&
      Math.abs(a.block.minimumSpan - b.block.minimumSpan) < 0.01 &&
      Math.abs(a.block.maximumSpan - b.block.maximumSpan) < 0.01 &&
      a.requestedScroll === b.requestedScroll;
    const position = () => {
      if (!live() || writing || ownershipLost) return;
      writing = true;
      let stable = false;
      try {
        for (const [name, value] of Object.entries({
          position: 'fixed',
          display: 'flex',
          'flex-direction': 'column',
          ...(!applied ? { 'justify-content': 'normal' } : {}),
        }))
          if (!write(name, value)) return;
        if (sizeLease) {
          const sized = sizeLease.apply();
          if (sized.kind !== 'matched') {
            if (sized.reason === 'detached-target')
              report({ status: 'pending-target', reason: 'detached-target' });
            else report({ status: 'unavailable', reason: sized.reason });
            return;
          }
        }
        // Inline constraints can reflow preceding rows. Never use pre-width block metrics.
        let candidate = readPlan();
        if (!candidate) return;
        for (let pass = 0; pass < 4; pass++) {
          for (const [name, value] of Object.entries({
            'min-width': `${candidate.inline.minimumSpan}px`,
            [candidate.inline.edge]: `${candidate.inline.inset}px`,
            [candidate.inline.edge === 'left' ? 'right' : 'left']: '',
          }))
            if (!write(name, value)) return;
          if (sizeLease) {
            const sized = sizeLease.apply();
            if (sized.kind !== 'matched') {
              if (sized.reason === 'detached-target')
                report({ status: 'pending-target', reason: 'detached-target' });
              else report({ status: 'unavailable', reason: sized.reason });
              return;
            }
          }
          const constrained = readPlan();
          if (!constrained) return;
          plan = constrained;
          const nextSpan = applied
            ? Math.min(Math.max(requestedSpan, plan.block.requestedSpan), plan.block.maximumSpan)
            : plan.block.requestedSpan;
          const styles: Record<string, string> = {
            top: plan.block.pin === 'start' ? '0px' : '',
            bottom: plan.block.pin === 'end' ? '0px' : '',
            margin: `${plan.block.margin}px 0px`,
            height: `${nextSpan}px`,
            'min-height': `${plan.block.minimumSpan}px`,
            'max-height': `${plan.block.maximumSpan}px`,
          };
          for (const [name, value] of Object.entries(styles)) if (!write(name, value)) return;
          requestedSpan = nextSpan;
          if (!applied && plan.requestedScroll !== undefined && live())
            targets.scrollport.scrollTop = plan.requestedScroll;
          previousScroll = targets.scrollport.scrollTop;
          const settled = readPlan();
          if (!settled) return;
          if (equivalent(candidate, constrained) && equivalent(constrained, settled)) {
            stable = true;
            break;
          }
          candidate = settled;
        }
      } finally {
        writing = false;
      }
      if (!live()) return;
      if (!stable) {
        report({ status: 'unavailable', reason: 'invalid-geometry' });
        return;
      }
      if (!applied) {
        applied = true;
        report({ status: 'applied' });
        if (!live()) return;
        frameTask = view.requestAnimationFrame(() => {
          frameTask = null;
          if (live()) expand = descriptor.constraints.expandOnScroll;
        });
      }
    };
    const onScroll = () => {
      if (!live() || writing || ownershipLost || !plan) return;
      const actualScroll = targets.scrollport.scrollTop;
      const result = reduceScrollExpansion({
        enabled: expand,
        previousActualScroll: previousScroll,
        actualScroll,
        previousRequestedSpan: requestedSpan,
        minimumSpan: plan.block.minimumSpan,
        availableSpan: view.innerHeight - descriptor.constraints.margin * 2,
        pin: plan.block.pin,
      });
      if (result.kind !== 'plan') return;
      previousScroll = actualScroll;
      writing = true;
      try {
        if (result.plan.requestedSpan !== undefined) {
          if (!write('height', `${result.plan.requestedSpan}px`)) return;
          requestedSpan = result.plan.requestedSpan;
        }
        if (result.plan.contentAlignment && !write('justify-content', 'flex-end')) return;
        if (result.plan.requestedScroll !== undefined && live())
          targets.scrollport.scrollTop = result.plan.requestedScroll;
        previousScroll = targets.scrollport.scrollTop;
      } finally {
        writing = false;
      }
    };
    const onOuterScroll = (event: Event) => {
      if (event.target !== targets.scrollport) position();
    };
    const observer =
      typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(() => position()) : null;
    for (const target of new Set([frame, ...keys.map((key) => targets[key]), ...sizeTargets]))
      observer?.observe(target);
    targets.scrollport.addEventListener('scroll', onScroll);
    doc.addEventListener('scroll', onOuterScroll, true);
    view.addEventListener('resize', position);
    stop = () => {
      observer?.disconnect();
      targets.scrollport.removeEventListener('scroll', onScroll);
      doc.removeEventListener('scroll', onOuterScroll, true);
      view.removeEventListener('resize', position);
      if (frameTask !== null) view.cancelAnimationFrame(frameTask);
      frameTask = null;
    };
    updateGeometry = position;
    position();
  };
  start();
  return {
    update(next) {
      if (disposed) return;
      if (sameGeometry(connection, next)) {
        connection = next;
        const request = version;
        updateGeometry?.();
        if (!disposed && version === request && connection === next && lastStatus)
          next.onAlignment?.(lastStatus);
        return;
      }
      connection = next;
      start();
    },
    requestUpdate() {
      if (!disposed) updateGeometry?.();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      version++;
      retire();
    },
  };
}
