import type { MaterialPaintReservation } from '@proto.ui/core';
import { prepareMaterialPaintReservationPart } from '@proto.ui/module-feedback';
import { readBorderOutline, rectangleInsideBorder } from './border-outline';

type Edges = Readonly<{ top: number; right: number; bottom: number; left: number }>;
export type MaterialPaintFootprint = Readonly<{
  view: number;
  revision: number;
  profile: string;
  edges: Edges;
}>;
export type MaterialPaintReservationResult =
  | { status: 'ready'; footprint: MaterialPaintFootprint; current(): boolean }
  | { status: 'unavailable'; reason: string };
type OwnedStyle = { previous: string; priority: string; value: string };
type Lease = {
  target: HTMLElement;
  part: HTMLElement;
  generation: object;
  active: boolean;
  ownerCurrent(): boolean;
  inlineSizeFrom: HTMLElement | null;
  outlineFrom: HTMLElement | null;
  styles: Map<string, OwnedStyle>;
  basis: { width: number; height: number; referenceInset: number | null } | null;
  footprint: MaterialPaintFootprint | null;
  pendingSize: {
    width: number;
    height: number | null;
    referenceWidth: number | null;
    outlineSignature: string | null;
  } | null;
};
const byTarget = new WeakMap<HTMLElement, Set<Lease>>();
const byPart = new WeakMap<HTMLElement, Lease>();
// Keep the last acquisition token after release so a cleanup cannot resume
// after a reentrant successor has itself already been released.
const partAcquisition = new WeakMap<HTMLElement, object>();
const unavailable = (reason: string): MaterialPaintReservationResult => ({
  status: 'unavailable',
  reason,
});

function composedContains(part: HTMLElement, target: HTMLElement) {
  let node: Node | null = target;
  while (node) {
    if (node === part) return true;
    if (node instanceof target.ownerDocument.defaultView!.Element && node.assignedSlot)
      node = node.assignedSlot;
    else if (node.parentNode) node = node.parentNode;
    else {
      const root = node.getRootNode();
      node = root instanceof target.ownerDocument.defaultView!.ShadowRoot ? root.host : null;
    }
  }
  return false;
}

function owns(lease: Lease) {
  return lease.active && lease.ownerCurrent() && byPart.get(lease.part) === lease;
}

function put(lease: Lease, property: string, value: string): boolean {
  if (!owns(lease)) return false;
  const { part, styles } = lease;
  let owned = styles.get(property);
  if (!owned) {
    owned = {
      previous: part.style.getPropertyValue(property),
      priority: part.style.getPropertyPriority(property),
      value: '',
    };
    if (!owns(lease)) return false;
    styles.set(property, owned);
  }
  if (
    part.style.getPropertyValue(property) === value &&
    part.style.getPropertyPriority(property) === ''
  ) {
    if (!owns(lease)) return false;
    owned.value = value;
    return true;
  }
  if (!owns(lease)) return false;
  part.style.setProperty(property, value);
  if (!owns(lease)) return false;
  owned.value = part.style.getPropertyValue(property);
  return owns(lease);
}

function release(lease: Lease) {
  if (!lease.active) return;
  lease.active = false;
  lease.footprint = null;
  byTarget.get(lease.target)?.delete(lease);
  // Reentry or a newer physical binding must never lose its owned styles.
  if (byPart.get(lease.part) !== lease) return;
  const acquisition = partAcquisition.get(lease.part);
  byPart.delete(lease.part);
  let failed = false;
  let first: unknown;
  for (const [property, owned] of lease.styles) {
    if (partAcquisition.get(lease.part) !== acquisition || byPart.has(lease.part)) break;
    try {
      if (
        lease.part.style.getPropertyValue(property) !== owned.value ||
        lease.part.style.getPropertyPriority(property) !== ''
      )
        continue;
      if (partAcquisition.get(lease.part) !== acquisition || byPart.has(lease.part)) break;
      if (owned.previous) lease.part.style.setProperty(property, owned.previous, owned.priority);
      else lease.part.style.removeProperty(property);
    } catch (error) {
      if (!failed) first = error;
      failed = true;
    }
  }
  lease.styles.clear();
  if (failed) throw first;
}

/** Host ingress for an already validated logical association. */
export function connectWebMaterialPaintReservation(
  target: HTMLElement,
  part: HTMLElement,
  generation: object,
  ownerCurrent: () => boolean = () => true,
  inlineSizeFrom: HTMLElement | null = null,
  outlineFrom: HTMLElement | null = null
): () => void {
  if (target === part || target.ownerDocument !== part.ownerDocument) return () => {};
  const acquisition = Object.freeze({});
  partAcquisition.set(part, acquisition);
  const previous = byPart.get(part);
  if (previous) release(previous);
  if (partAcquisition.get(part) !== acquisition || !ownerCurrent()) return () => {};
  const lease: Lease = {
    target,
    part,
    generation,
    active: true,
    ownerCurrent,
    inlineSizeFrom,
    outlineFrom,
    styles: new Map(),
    basis: null,
    footprint: null,
    pendingSize: null,
  };
  let targets = byTarget.get(target);
  if (!targets) byTarget.set(target, (targets = new Set()));
  targets.add(lease);
  byPart.set(part, lease);
  // Neutral structural transport only: no role, tabindex, hidden or inert.
  // This initial owned style also participates in the existing event-driven
  // material geometry observer; there is no second per-part RAF/observer loop.
  try {
    put(lease, 'display', 'block');
    if (owns(lease)) put(lease, 'box-sizing', 'content-box');
  } catch (error) {
    try {
      release(lease);
    } catch {}
    throw error;
  }
  return () => release(lease);
}

export function createWebMaterialPaintReservationRef(target: MaterialPaintReservation) {
  const bind = prepareMaterialPaintReservationPart(target);
  let current: HTMLElement | null = null;
  let disconnect: (() => void) | null = null;
  return (part: HTMLElement | null) => {
    if (part === current) return;
    const previous = disconnect;
    disconnect = null;
    current = part;
    previous?.();
    if (!part || current !== part) return;
    const releasePart = bind({
      identity: part,
      connect(physicalTarget, generation, ownerCurrent, inlineSizeFrom, outlineFrom) {
        const win = part.ownerDocument.defaultView;
        if (!win || !(physicalTarget instanceof win.HTMLElement)) return () => {};
        if (inlineSizeFrom !== null && !(inlineSizeFrom instanceof win.HTMLElement))
          return () => {};
        if (outlineFrom !== null && !(outlineFrom instanceof win.HTMLElement)) return () => {};
        return connectWebMaterialPaintReservation(
          physicalTarget,
          part,
          generation,
          ownerCurrent,
          inlineSizeFrom as HTMLElement | null,
          outlineFrom as HTMLElement | null
        );
      },
    });
    if (current === part) disconnect = releasePart;
    else releasePart();
  };
}

const near = (a: number, b: number) => Math.abs(a - b) <= 0.02;
function current(lease: Lease) {
  return (
    owns(lease) &&
    lease.target.isConnected &&
    lease.part.isConnected &&
    lease.target.ownerDocument === lease.part.ownerDocument &&
    composedContains(lease.part, lease.target) &&
    owns(lease) &&
    byTarget.get(lease.target)?.size === 1
  );
}

/**
 * Called by the existing material geometry transaction. Measurements are of
 * the target, never of a recursively expanded reservation box. One write pass
 * is followed by a later geometry delivery; it does not iterate toward a fit.
 */
export function updateWebMaterialPaintReservation(
  target: HTMLElement,
  footprint: MaterialPaintFootprint | null
): MaterialPaintReservationResult {
  const leases = byTarget.get(target);
  if (!leases || leases.size !== 1)
    return unavailable(leases?.size ? 'paint-reservation-ambiguous' : 'paint-reservation-missing');
  const lease = [...leases][0]!;
  if (!current(lease)) return unavailable('paint-reservation-owner-unavailable');
  if (
    !footprint ||
    !Number.isSafeInteger(footprint.view) ||
    footprint.view < 0 ||
    !Number.isSafeInteger(footprint.revision) ||
    footprint.revision < 0 ||
    typeof footprint.profile !== 'string' ||
    !footprint.profile ||
    !footprint.edges ||
    ['top', 'right', 'bottom', 'left'].some((edge) => {
      const value = footprint.edges[edge as keyof Edges];
      return !Number.isFinite(value) || value < 0 || value > 165;
    })
  )
    return unavailable('paint-footprint-unavailable');
  if (
    lease.footprint &&
    (footprint.view < lease.footprint.view ||
      (footprint.view === lease.footprint.view && footprint.revision < lease.footprint.revision))
  )
    return unavailable('paint-footprint-stale');
  for (const [property, owned] of lease.styles) {
    if (
      lease.part.style.getPropertyValue(property) !== owned.value ||
      lease.part.style.getPropertyPriority(property)
    )
      return unavailable('paint-reservation-style-conflict');
  }
  const box = target.getBoundingClientRect();
  const part = lease.part.getBoundingClientRect();
  if (
    ![box.x, box.y, box.width, box.height, part.x, part.y, part.width, part.height].every(
      Number.isFinite
    ) ||
    box.width <= 0 ||
    box.height <= 0
  )
    return unavailable('paint-reservation-geometry-unavailable');
  const css = target.ownerDocument.defaultView!.getComputedStyle(lease.part);
  if (
    css.display !== 'block' ||
    css.boxSizing !== 'content-box' ||
    ['transform', 'rotate', 'scale', 'translate'].some(
      (property) => css.getPropertyValue(property) && css.getPropertyValue(property) !== 'none'
    ) ||
    ['overflow', 'overflow-x', 'overflow-y'].some(
      (property) => css.getPropertyValue(property) && css.getPropertyValue(property) !== 'visible'
    )
  )
    return unavailable('paint-reservation-layout-unsupported');
  const footprintEdges = footprint.edges;
  let outlineSignature: string | null = null;
  let extraTop = 0,
    extraBottom = 0;
  if (lease.outlineFrom) {
    const outline = lease.outlineFrom;
    if (
      !outline.isConnected ||
      outline.ownerDocument !== target.ownerDocument ||
      outline === lease.part ||
      !composedContains(outline, lease.part)
    )
      return unavailable('paint-reservation-outline-unavailable');
    const read = readBorderOutline(outline);
    if (read.status === 'unsupported') return unavailable('paint-reservation-outline-unsupported');
    outlineSignature = read.signature;
    extraTop = read.blockClearance.top;
    extraBottom = read.blockClearance.bottom;
    if (
      ![extraTop, extraBottom].every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 165
      )
    )
      return unavailable('paint-reservation-outline-budget-unavailable');
  }
  const edges = {
    ...footprintEdges,
    top: footprintEdges.top + extraTop,
    bottom: footprintEdges.bottom + extraBottom,
  };
  let referenceWidth: number | null = null;
  if (lease.inlineSizeFrom) {
    const reference = lease.inlineSizeFrom;
    if (
      !reference.isConnected ||
      reference.ownerDocument !== target.ownerDocument ||
      composedContains(lease.part, reference) ||
      !composedContains(reference, lease.part)
    )
      return unavailable('paint-reservation-inline-reference-unavailable');
    const referenceCss = target.ownerDocument.defaultView!.getComputedStyle(reference);
    const referenceBox = reference.getBoundingClientRect();
    referenceWidth =
      referenceBox.width -
      ['padding-left', 'padding-right', 'border-left-width', 'border-right-width'].reduce(
        (sum, property) => sum + (parseFloat(referenceCss.getPropertyValue(property)) || 0),
        0
      );
    if (!Number.isFinite(referenceWidth) || referenceWidth <= 0)
      return unavailable('paint-reservation-inline-reference-unavailable');
  }
  if (!current(lease)) return unavailable('paint-reservation-owner-unavailable');
  if (lease.pendingSize && lease.pendingSize.outlineSignature !== outlineSignature)
    return unavailable('paint-reservation-outline-feedback');
  if (lease.pendingSize && lease.pendingSize.referenceWidth !== referenceWidth)
    return unavailable('paint-reservation-inline-reference-feedback');
  if (
    lease.pendingSize &&
    (!near(box.width, lease.pendingSize.width) ||
      (lease.pendingSize.height !== null && !near(box.height, lease.pendingSize.height)))
  )
    return unavailable('paint-reservation-constraints-unavailable');
  if (!lease.basis) {
    if (!near(part.width, box.width) || !near(part.height, box.height))
      return unavailable('paint-reservation-part-not-exact');
    if (
      ['top', 'right', 'bottom', 'left'].some(
        (edge) => parseFloat(css.getPropertyValue(`padding-${edge}`) || '0') !== 0
      )
    )
      return unavailable('paint-reservation-consumer-padding');
    lease.basis = {
      width: box.width,
      height: box.height,
      referenceInset: referenceWidth === null ? null : referenceWidth - box.width,
    };
  }
  const basisWidth =
    referenceWidth === null ? lease.basis.width : referenceWidth - lease.basis.referenceInset!;
  if (!Number.isFinite(basisWidth) || basisWidth <= 0)
    return unavailable('paint-reservation-inline-reference-unavailable');
  const next = {
    width: `${basisWidth}px`,
    'padding-top': `${edges.top}px`,
    'padding-right': `${edges.right}px`,
    'padding-bottom': `${edges.bottom}px`,
    'padding-left': `${edges.left}px`,
  };
  const changed = Object.entries(next).some(
    ([property, value]) => lease.part.style.getPropertyValue(property) !== value
  );
  if (changed) {
    // All reads above precede all writes. Neither target styles nor consumer
    // padding/ancestors are modified. Constraints are checked on the next turn.
    if (!current(lease)) return unavailable('paint-reservation-owner-unavailable');
    lease.pendingSize = {
      width: basisWidth,
      height: near(basisWidth, box.width) ? box.height : null,
      referenceWidth,
      outlineSignature,
    };
    for (const [property, value] of Object.entries(next))
      if (!put(lease, property, value)) return unavailable('paint-reservation-owner-unavailable');
    if (!current(lease)) return unavailable('paint-reservation-owner-unavailable');
    lease.footprint = Object.freeze({ ...footprint, edges: Object.freeze({ ...footprintEdges }) });
    return unavailable('paint-reservation-layout-pending');
  }
  if (
    !near(box.width, basisWidth) ||
    !near(part.width, box.width + edges.left + edges.right) ||
    !near(part.height, box.height + edges.top + edges.bottom) ||
    !near(box.left - part.left, edges.left) ||
    !near(box.top - part.top, edges.top)
  )
    return unavailable('paint-reservation-constraints-unavailable');
  if (lease.outlineFrom) {
    const read = readBorderOutline(lease.outlineFrom);
    if (
      read.status === 'unsupported' ||
      read.signature !== outlineSignature ||
      (read.status === 'border' &&
        !rectangleInsideBorder(
          {
            left: box.left - footprintEdges.left,
            right: box.right + footprintEdges.right,
            top: box.top - footprintEdges.top,
            bottom: box.bottom + footprintEdges.bottom,
          },
          read.border
        ))
    )
      return unavailable('paint-reservation-outline-overlap');
  }
  if (!current(lease)) return unavailable('paint-reservation-owner-unavailable');
  lease.pendingSize = null;
  lease.footprint = Object.freeze({ ...footprint, edges: Object.freeze({ ...footprintEdges }) });
  const admitted = lease.footprint;
  return {
    status: 'ready',
    footprint: admitted,
    current() {
      if (!current(lease) || byTarget.get(target)?.size !== 1) return false;
      const latest = lease.footprint;
      if (
        !latest ||
        latest.view !== admitted.view ||
        latest.revision < admitted.revision ||
        latest.profile !== admitted.profile ||
        (['top', 'right', 'bottom', 'left'] as const).some(
          (edge) => latest.edges[edge] !== admitted.edges[edge]
        )
      )
        return false;
      for (const [property, owned] of lease.styles)
        if (
          lease.part.style.getPropertyValue(property) !== owned.value ||
          lease.part.style.getPropertyPriority(property)
        )
          return false;
      const now = target.getBoundingClientRect();
      const nowPart = lease.part.getBoundingClientRect();
      let sameReference = true;
      if (lease.inlineSizeFrom) {
        const ref = lease.inlineSizeFrom;
        const refBox = ref.getBoundingClientRect();
        const refCss = target.ownerDocument.defaultView!.getComputedStyle(ref);
        const width =
          refBox.width -
          ['padding-left', 'padding-right', 'border-left-width', 'border-right-width'].reduce(
            (sum, property) => sum + (parseFloat(refCss.getPropertyValue(property)) || 0),
            0
          );
        sameReference =
          ref.isConnected &&
          ref.ownerDocument === target.ownerDocument &&
          !composedContains(lease.part, ref) &&
          composedContains(ref, lease.part) &&
          width === referenceWidth;
      }
      let sameOutline = true;
      if (lease.outlineFrom) {
        const outline = lease.outlineFrom;
        const read = readBorderOutline(outline);
        sameOutline =
          outline.isConnected &&
          outline.ownerDocument === target.ownerDocument &&
          composedContains(outline, lease.part) &&
          read.status !== 'unsupported' &&
          read.signature === outlineSignature &&
          (read.status !== 'border' ||
            rectangleInsideBorder(
              {
                left: now.left - admitted.edges.left,
                right: now.right + admitted.edges.right,
                top: now.top - admitted.edges.top,
                bottom: now.bottom + admitted.edges.bottom,
              },
              read.border
            ));
      }
      return (
        near(now.width, box.width) &&
        near(now.height, box.height) &&
        near(nowPart.width, now.width + edges.left + edges.right) &&
        near(nowPart.height, now.height + edges.top + edges.bottom) &&
        near(now.left - nowPart.left, edges.left) &&
        near(now.top - nowPart.top, edges.top) &&
        sameReference &&
        sameOutline &&
        current(lease) &&
        lease.footprint === latest
      );
    },
  };
}

export function releaseWebMaterialPaintFootprint(target: HTMLElement, view: number) {
  for (const lease of byTarget.get(target) ?? []) {
    if (lease.footprint?.view === view) lease.footprint = null;
  }
}
