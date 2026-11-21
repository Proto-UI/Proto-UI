/** Reached DOM host primitives for C-A11Y-PART-RELATIONSHIP-0001 (draft). */
export const NATIVE_PART_RELATIONSHIPS_SOURCE = String.raw`
type NativePartKey = string | { get(): unknown };
type NativePartTarget = { kind: 'part'; family: NativeAnatomyFamily; role: string; key: NativePartKey };
type NativePartProjection = { view: HTMLElement; attribute: string; token: string };
type NativePartRecord = {
  owner: Owner; view: HTMLElement | null; epoch: number; currentEpoch(): number; hostScope: Document | ShadowRoot | null;
  parts: Map<NativeAnatomyFamily, NativePartKey>;
  relations: Map<string, { target: NativePartTarget; attribute: string }>;
  projections: Map<string, NativePartProjection>;
  diagnostics: Map<string, string>;
  subscriptions: Map<string | NativeAnatomyFamily, () => void>;
  reservation: { scope: Document | ShadowRoot; id: string } | null;
  binding: { view: HTMLElement; id: string; previous: string | null; owned: boolean } | null;
};
type NativePartTokens = { baseline: Set<string>; leases: Map<object, string>; projected: string | null };
interface NativePartRelationships {
  part(family: NativeAnatomyFamily, key: NativePartKey): void;
  relation(kind: string, target: NativePartTarget, attribute: string): void;
  removeRelation(kind: string): void;
  refresh(view: HTMLElement | null): void;
  unmount(): void;
  dispose(): void;
}
const partRelationshipRecords = new Map<Owner, NativePartRecord>();
const partRelationshipIds = new WeakMap<Document | ShadowRoot, Map<string, NativePartRecord>>();
const partRelationshipTokens = new WeakMap<HTMLElement, Map<string, NativePartTokens>>();
const partRelationshipScopes = new WeakMap<Document | ShadowRoot, { records: Set<NativePartRecord>; observer: MutationObserver | null }>();
const partRelationshipPublication = { active: false, pending: false };
function nativePartKey(key: NativePartKey): string | null {
  const value = typeof key === 'string' ? key : key.get();
  return typeof value === 'string' && value.length ? value : null;
}
function nativePartWriteTokens(view: HTMLElement, attribute: string, ledger: NativePartTokens, changed = false) {
  const current = view.getAttribute(attribute);
  if (!changed && current === ledger.projected) return;
  if (current !== ledger.projected) {
    const next = new Set(current?.trim().split(/\s+/).filter(Boolean) ?? []);
    for (const token of ledger.leases.values()) if (!ledger.baseline.has(token)) next.delete(token);
    ledger.baseline = next;
  }
  const tokens = new Set(ledger.baseline);
  for (const token of ledger.leases.values()) tokens.add(token);
  const value = tokens.size ? [...tokens].join(' ') : null;
  if (current !== value) { if (value === null) view.removeAttribute(attribute); else view.setAttribute(attribute, value); }
  ledger.projected = value;
}
function nativePartReleaseProjection(record: NativePartRecord, kind: string) {
  const projection = record.projections.get(kind);
  if (!projection) return;
  const attributes = partRelationshipTokens.get(projection.view), ledger = attributes?.get(projection.attribute);
  if (ledger) {
    // Observe host edits while the old lease still identifies its own token.
    nativePartWriteTokens(projection.view, projection.attribute, ledger);
    ledger.leases.delete(projection);
    nativePartWriteTokens(projection.view, projection.attribute, ledger, true);
    if (!ledger.leases.size) { attributes!.delete(projection.attribute); if (!attributes!.size) partRelationshipTokens.delete(projection.view); }
  }
  record.projections.delete(kind);
}
function nativePartProject(record: NativePartRecord, kind: string, attribute: string, token: string | null) {
  const previous = record.projections.get(kind), view = record.view;
  if (previous && (previous.view !== view || previous.attribute !== attribute || previous.token !== token)) nativePartReleaseProjection(record, kind);
  if (!view || !token) return;
  let attributes = partRelationshipTokens.get(view);
  if (!attributes) { attributes = new Map(); partRelationshipTokens.set(view, attributes); }
  let ledger = attributes.get(attribute);
  if (!ledger) { const current = view.getAttribute(attribute); ledger = { baseline: new Set(current?.trim().split(/\s+/).filter(Boolean) ?? []), leases: new Map(), projected: current }; attributes.set(attribute, ledger); }
  let projection = record.projections.get(kind);
  const acquiring = !projection;
  if (!projection) {
    nativePartWriteTokens(view, attribute, ledger);
    projection = { view, attribute, token }; record.projections.set(kind, projection); ledger.leases.set(projection, token);
  }
  nativePartWriteTokens(view, attribute, ledger, acquiring);
}
function nativePartReleaseBinding(record: NativePartRecord) {
  const binding = record.binding;
  record.binding = null;
  if (binding?.owned && binding.view.getAttribute('id') === binding.id) {
    if (binding.previous === null) binding.view.removeAttribute('id'); else binding.view.setAttribute('id', binding.previous);
  }
}
function nativePartReleaseReservation(record: NativePartRecord) {
  const reservation = record.reservation;
  if (reservation && partRelationshipIds.get(reservation.scope)?.get(reservation.id) === record) partRelationshipIds.get(reservation.scope)!.delete(reservation.id);
  record.reservation = null;
}
function nativePartId(record: NativePartRecord): string | null {
  const view = record.view;
  if (!view?.isConnected || view !== record.owner.target() || record.epoch !== record.currentEpoch() || !record.owner.alive()) return null;
  const current = view.getAttribute('id');
  if (record.binding?.view === view && current !== record.binding.id) {
    // A live host edit retires the old identity without restoring over that edit.
    nativePartReleaseBinding(record); nativePartReleaseReservation(record);
  }
  if (current && /\s/.test(current)) return null;
  const scope = view.getRootNode() as Document | ShadowRoot;
  let reservations = partRelationshipIds.get(scope);
  if (!reservations) { reservations = new Map(); partRelationshipIds.set(scope, reservations); }
  let id = record.reservation?.id;
  if (record.reservation && record.reservation.scope !== scope) return null;
  if (current && id && current !== id) return null;
  if (!id) {
    id = current || 'pui-part-' + nextHostId++;
    while (!current && (reservations.has(id) || scope.getElementById(id))) id = 'pui-part-' + nextHostId++;
  }
  if (reservations.has(id) && reservations.get(id) !== record) return null;
  for (const candidate of scope.querySelectorAll('[id]')) if (candidate !== view && candidate.getAttribute('id') === id) return null;
  if (!record.reservation) { record.reservation = { scope, id }; reservations.set(id, record); }
  if (!record.binding) record.binding = { view, id, previous: current, owned: !current };
  if (!current) view.setAttribute('id', id);
  return id;
}
function publishNativePartRelationships() {
  partRelationshipPublication.pending = true;
  if (partRelationshipPublication.active) return;
  partRelationshipPublication.active = true;
  try {
    while (partRelationshipPublication.pending) {
      partRelationshipPublication.pending = false;
      for (const record of partRelationshipRecords.values()) {
        if (!record.owner.alive() || !record.view || record.view !== record.owner.target() || record.epoch !== record.currentEpoch()) {
          for (const kind of record.projections.keys()) nativePartReleaseProjection(record, kind);
          continue;
        }
        for (const [kind, relation] of record.relations) {
          const { family, role, key } = relation.target;
          const scope = ancestor(record.owner, candidate => candidate.claims.get(family)?.role === 'root'), matchKey = nativePartKey(key);
          let target: NativePartRecord | null = null, count = 0;
          if (scope && record.owner.claims.has(family) && matchKey) {
            for (const candidate of partRelationshipRecords.values()) {
              const candidateKey = candidate.parts.get(family);
              if (candidate.owner.alive() && candidateKey !== undefined && candidate.owner.claims.get(family)?.role === role && ancestor(candidate.owner, parent => parent.claims.get(family)?.role === 'root') === scope && nativePartKey(candidateKey) === matchKey) { target = candidate; ++count; }
            }
          }
          const diagnostic = !scope || !record.owner.claims.has(family) ? 'missing-source' : !matchKey ? 'missing-key' : count === 0 ? 'missing-target' : count > 1 ? 'ambiguous-target' : null;
          if (diagnostic && record.diagnostics.get(kind) !== diagnostic) console.warn('[A11y] ' + diagnostic + ' for part relationship ' + kind + '.');
          if (diagnostic) record.diagnostics.set(kind, diagnostic); else record.diagnostics.delete(kind);
          const available = !diagnostic && record.view.isConnected && target?.view?.isConnected && target.view === target.owner.target() && target.epoch === target.currentEpoch() && target.view.getRootNode() === record.view.getRootNode();
          const id = available ? nativePartId(target!) : null;
          nativePartProject(record, kind, relation.attribute, id);
        }
      }
    }
  } finally { partRelationshipPublication.active = false; }
}
function createNativePartRelationships(owner: Owner, currentEpoch: () => number, subscribe: (key: { get(): unknown }, callback: () => void) => (() => void) | undefined): NativePartRelationships {
  const record: NativePartRecord = { owner, view: null, epoch: currentEpoch(), currentEpoch, hostScope: null, parts: new Map(), relations: new Map(), projections: new Map(), diagnostics: new Map(), subscriptions: new Map(), reservation: null, binding: null };
  partRelationshipRecords.set(owner, record);
  let disposed = false;
  function watch(identity: string | NativeAnatomyFamily, key: NativePartKey) {
    record.subscriptions.get(identity)?.(); record.subscriptions.delete(identity);
    if (typeof key !== 'string') { const off = subscribe(key, publishNativePartRelationships); if (off) record.subscriptions.set(identity, off); }
  }
  function leaveScope() {
    const scope = record.hostScope;
    record.hostScope = null;
    if (!scope) return;
    const registration = partRelationshipScopes.get(scope);
    registration?.records.delete(record);
    if (registration && !registration.records.size) { registration.observer?.disconnect(); partRelationshipScopes.delete(scope); }
  }
  function unmount() {
    record.view = null;
    // Withdraw dependent sources before restoring the departing target's identity.
    publishNativePartRelationships();
    for (const kind of record.projections.keys()) nativePartReleaseProjection(record, kind);
    nativePartReleaseBinding(record);
    leaveScope();
  }
  return {
    part(family, key) {
      if (record.parts.has(family)) throw new Error('[A11y] duplicate part declaration for family.');
      record.parts.set(family, key); watch(family, key);
    },
    relation(kind, target, attribute) {
      record.relations.set(kind, { target: { ...target }, attribute }); watch(kind, target.key);
    },
    removeRelation(kind) {
      record.relations.delete(kind); record.diagnostics.delete(kind);
      record.subscriptions.get(kind)?.(); record.subscriptions.delete(kind);
      nativePartReleaseProjection(record, kind);
    },
    refresh(view) {
      if (disposed) return;
      const hostScope = view?.getRootNode() as Document | ShadowRoot | undefined;
      if (record.view !== view || record.epoch !== currentEpoch() || record.hostScope !== (hostScope ?? null)) {
        unmount(); record.view = view; record.epoch = currentEpoch();
        if (view) {
          let registration = partRelationshipScopes.get(hostScope!);
          if (!registration) {
            const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(publishNativePartRelationships);
            registration = { records: new Set(), observer }; partRelationshipScopes.set(hostScope!, registration);
            observer?.observe(hostScope!, { attributes: true, attributeFilter: ['id'], childList: true, subtree: true });
          }
          registration.records.add(record); record.hostScope = hostScope!;
        }
      }
      publishNativePartRelationships();
    },
    unmount,
    dispose() {
      if (disposed) return;
      disposed = true;
      const failures: unknown[] = [];
      try { unmount(); } catch (error) { failures.push(error); }
      partRelationshipRecords.delete(owner);
      for (const off of record.subscriptions.values()) try { off(); } catch (error) { failures.push(error); }
      record.subscriptions.clear(); record.parts.clear(); record.relations.clear(); record.diagnostics.clear();
      nativePartReleaseReservation(record);
      try { publishNativePartRelationships(); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, '[A11y] part relationship disposal failed.');
    },
  };
}
`;
