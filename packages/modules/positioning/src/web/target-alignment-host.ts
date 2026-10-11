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
    const parent = current.offsetParent;
    if (!element(parent)) break;
    top += parent.clientTop;
    current = parent;
  }
  return top;
}
const relativeTop = (node: HTMLElement, ancestor: HTMLElement) =>
  layoutTop(node) - layoutTop(ancestor) - ancestor.clientTop;

type StyleClaim = { before: string; priority: string; written: string };
const styleOwners = new WeakMap<HTMLElement, Map<string, StyleClaim>>();

/** Claims are identity-owned across synchronous lease handoffs, not merely value-owned. */
function ownStyles(target: HTMLElement) {
  const fields = new Map<string, StyleClaim>();
  let owners = styleOwners.get(target);
  if (!owners) {
    owners = new Map();
    styleOwners.set(target, owners);
  }
  const currentOwners = owners;
  let lost = false;
  const matches = (name: string, record: StyleClaim) =>
    target.style.getPropertyValue(name) === record.written &&
    target.style.getPropertyPriority(name) === '';
  return {
    write(name: string, value: string): boolean {
      if (lost) return false;
      let record = fields.get(name);
      if (record && (currentOwners.get(name) !== record || !matches(name, record))) {
        lost = true;
        return false;
      }
      if (!record) {
        const prior = currentOwners.get(name);
        const inherit = prior && matches(name, prior);
        record = {
          before: inherit ? prior.before : target.style.getPropertyValue(name),
          priority: inherit ? prior.priority : target.style.getPropertyPriority(name),
          written: '',
        };
        fields.set(name, record);
        currentOwners.set(name, record);
      }
      target.style.setProperty(name, value);
      record.written = target.style.getPropertyValue(name);
      return true;
    },
    restore() {
      for (const [name, record] of fields) {
        if (currentOwners.get(name) !== record) continue;
        currentOwners.delete(name);
        if (!matches(name, record)) continue;
        if (record.before) target.style.setProperty(name, record.before, record.priority);
        else target.style.removeProperty(name);
      }
      fields.clear();
    },
  };
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
  return (
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
    const owned = ownStyles(frame);
    restore = () => owned.restore();
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
      keys.every((key) => targets[key].isConnected && targets[key].ownerDocument === doc);
    const readPlan = (): TargetAlignmentPlan | null => {
      if (!live() || !connected()) {
        if (live()) report({ status: 'pending-target', reason: 'detached-target' });
        return null;
      }
      const reference = targets.blockReference.getBoundingClientRect();
      const value = targets.inlineReference.getBoundingClientRect();
      const surface = targets.surface.getBoundingClientRect();
      const text = targets.inlineTarget.getBoundingClientRect();
      if (targets.blockTarget.offsetHeight <= 0 || reference.height <= 0) {
        report({ status: 'pending-target', reason: 'missing-target' });
        return null;
      }
      const paint = view.getComputedStyle(targets.surface);
      const scroll = view.getComputedStyle(targets.scrollport);
      const css = (text: string) => Number.parseInt(text, 10);
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
            left: surface.left,
            right: surface.right,
            width: surface.width,
            clientHeight: targets.surface.clientHeight,
            borderTop: css(paint.borderTopWidth),
            borderBottom: css(paint.borderBottomWidth),
            paddingTop: css(paint.paddingTop),
            paddingBottom: css(paint.paddingBottom),
          },
          target: {
            textLeft: text.left,
            textRight: text.right,
            offset: relativeTop(targets.blockTarget, targets.scrollport),
            height: targets.blockTarget.offsetHeight,
            atStart: descriptor.atStart,
            atEnd: descriptor.atEnd,
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
    for (const target of new Set([frame, ...keys.map((key) => targets[key])]))
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
