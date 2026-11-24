/** Shared synchronous physical lease owner; geometry/optical updates stay in the lazy material host. */
import type { MaterialPaintReservation } from '@proto.ui/core';
import { prepareMaterialPaintReservationPart } from '@proto.ui/module-feedback';

type Edges = Readonly<{ top: number; right: number; bottom: number; left: number }>;
export type MaterialPaintFootprint = Readonly<{
  view: number;
  revision: number;
  profile: string;
  edges: Edges;
}>;
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
/** Internal material updater access; the default public ref imports no geometry implementation. */
export function getWebMaterialPaintReservationLeases(
  target: HTMLElement
): ReadonlySet<Lease> | undefined {
  return byTarget.get(target);
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

export type { Lease as WebMaterialPaintReservationLease };
export { owns as ownsWebMaterialPaintReservation, put as writeWebMaterialPaintReservationStyle };
