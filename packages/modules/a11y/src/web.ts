import {
  isA11ySemanticObjectRef,
  type A11yRelationMode,
  type A11ySemanticObjectRef,
  type A11ySemanticObjectSnapshot,
} from '@proto.ui/core';

import type { A11yProjector } from './caps';

const ARIA_STATE_ATTRS: Record<string, string> = {
  atomic: 'aria-atomic',
  busy: 'aria-busy',
  checked: 'aria-checked',
  disabled: 'aria-disabled',
  expanded: 'aria-expanded',
  hasPopup: 'aria-haspopup',
  invalid: 'aria-invalid',
  live: 'aria-live',
  orientation: 'aria-orientation',
  pressed: 'aria-pressed',
  readOnly: 'aria-readonly',
  selected: 'aria-selected',
  modal: 'aria-modal',
};

const ARIA_RELATION_ATTRS: Record<string, string> = {
  controls: 'aria-controls',
  describedBy: 'aria-describedby',
  labelledBy: 'aria-labelledby',
};

type RelationProjection = {
  target: HTMLElement;
  attr: string;
  mode: A11yRelationMode;
  tokens: readonly string[];
  // Preserve authored string serialization; undefined denotes a structured relation.
  value?: string;
};

type RelationOwnership = {
  baseline: Set<string>;
  counts: Map<string, number>;
  projections: Set<RelationProjection>;
  // undefined invalidates restoration after a host rewrite; null is an owned removal.
  projectedValue: string | null | undefined;
};

type ScalarAttributes = Map<string, string | undefined>;

type ScalarOwnership = {
  baseline: string | null;
  // undefined invalidates restoration after a host rewrite; null is an owned removal.
  projectedValue: string | null | undefined;
  counts: Map<string | undefined, number>;
  // Generated identities affected by this shared id contribution, never host baseline data.
  affectedIdRefs?: Set<A11ySemanticObjectRef>;
};

type IdReservation = {
  id: string;
  objectRef: A11ySemanticObjectRef;
  count: number;
};

type WebProjectorRecord = {
  getTarget: () => HTMLElement | null;
  target: HTMLElement | null;
  targetDocument: Document | null;
  snapshot: A11ySemanticObjectSnapshot | null;
  objectRef: A11ySemanticObjectRef | null;
  reservedId: string | null;
  reservedDocument: Document | null;
  ownedIdTarget: HTMLElement | null;
  lastTargetId: string | null;
  dependencyRefs: Set<A11ySemanticObjectRef>;
  projections: Map<string, RelationProjection>;
  // Released before record.target changes, including an A -> null -> A transition.
  scalarAttributes: ScalarAttributes;
  detached: boolean;
  disposed: boolean;
};

export type WebA11yProjectionRegistry = {
  createProjector(
    getTarget: () => HTMLElement | null,
    subscribeTargetChange?: (listener: () => void) => () => void
  ): A11yProjector;
};

export function createWebA11yProjectionRegistry(
  options: { idPrefix?: string } = {}
): WebA11yProjectionRegistry {
  const idPrefix = options.idPrefix?.trim().replace(/\s+/g, '-') || 'pui-a11y';
  const dependentSourcesByRef = new Map<A11ySemanticObjectRef, Set<WebProjectorRecord>>();
  const recordsByRef = new Map<A11ySemanticObjectRef, Set<WebProjectorRecord>>();
  const reservedIdsByDocument = new Map<Document, Map<string, IdReservation>>();
  // Current shared choice; older cap leases can retain a different ID until disposal.
  const reservedIdsByRef = new Map<A11ySemanticObjectRef, Map<Document, IdReservation>>();
  const scalarAttributeRefs = new WeakMap<HTMLElement, Map<string, ScalarOwnership>>();
  const relationOwnerships = new WeakMap<HTMLElement, Map<string, RelationOwnership>>();

  const releaseScalarAttribute = (record: WebProjectorRecord, attr: string) => {
    const target = record.target;
    if (!target) return;
    const byAttribute = scalarAttributeRefs.get(target);
    if (!byAttribute) return;
    const ownership = byAttribute.get(attr);
    if (!ownership) return;
    const value = record.scalarAttributes.get(attr);
    const count = ownership.counts.get(value);
    if (!count || !record.scalarAttributes.delete(attr)) return;
    if (count === 1) ownership.counts.delete(value);
    else ownership.counts.set(value, count - 1);
    const current = target.getAttribute(attr);
    if (current !== ownership.projectedValue) {
      // A host rewrite supersedes the baseline; cleanup must not replay over it.
      ownership.baseline = current;
      ownership.projectedValue = undefined;
    } else if (count === 1 && current === (value ?? null)) {
      const baseline = ownership.baseline;
      if (baseline !== current) {
        if (baseline === null) target.removeAttribute(attr);
        else target.setAttribute(attr, baseline);
      }
      ownership.projectedValue = baseline;
    }
    if (ownership.counts.size === 0) byAttribute.delete(attr);
    if (byAttribute.size === 0) scalarAttributeRefs.delete(target);
  };

  const releaseScalarAttributes = (record: WebProjectorRecord, removeOwned = true) => {
    if (!removeOwned) return;
    const affectedIdRefs =
      record.scalarAttributes.has('id') && record.target
        ? scalarAttributeRefs.get(record.target)?.get('id')?.affectedIdRefs
        : undefined;
    for (const attr of record.scalarAttributes.keys()) releaseScalarAttribute(record, attr);
    return affectedIdRefs;
  };

  const acquireScalarAttributes = (
    record: WebProjectorRecord,
    target: HTMLElement,
    snapshot: A11ySemanticObjectSnapshot,
    affectedIdRefs?: Set<A11ySemanticObjectRef>
  ) => {
    const attributes = projectedScalarAttributes(snapshot, false);
    // An explicit id takes over the physical target's generated ownership, not a host baseline.
    if (attributes.has('id')) {
      const reservation = reservedIdsByDocument.get(target.ownerDocument)?.get(target.id);
      const owners = reservation && recordsByRef.get(reservation.objectRef);
      if (owners) {
        for (const owner of owners) {
          if (owner.ownedIdTarget !== target) continue;
          if (owner !== record && owner.objectRef) {
            (affectedIdRefs ??= new Set()).add(owner.objectRef);
          }
          releaseOwnedId(owner);
        }
      }
    }
    let byAttribute = scalarAttributeRefs.get(target);
    for (const [attr, value] of attributes) {
      if (!byAttribute) {
        byAttribute = new Map();
        scalarAttributeRefs.set(target, byAttribute);
      }
      const current = target.getAttribute(attr);
      let ownership = byAttribute.get(attr);
      if (!ownership) {
        ownership = { baseline: current, projectedValue: current, counts: new Map() };
        byAttribute.set(attr, ownership);
      } else if (current !== ownership.projectedValue) ownership.baseline = current;
      ownership.counts.set(value, (ownership.counts.get(value) ?? 0) + 1);
      ownership.projectedValue = value ?? null;
      if (affectedIdRefs && attr === 'id') {
        if (!ownership.affectedIdRefs) ownership.affectedIdRefs = affectedIdRefs;
        else if (ownership.affectedIdRefs !== affectedIdRefs) {
          for (const ref of affectedIdRefs) ownership.affectedIdRefs.add(ref);
        }
      }
    }
    record.scalarAttributes = attributes;
    return attributes;
  };

  let nextId = 1;

  const unindex = (record: WebProjectorRecord) => {
    if (!record.objectRef) return;
    const indexed = recordsByRef.get(record.objectRef);
    if (!indexed) return;
    indexed.delete(record);
    if (indexed.size === 0) recordsByRef.delete(record.objectRef);
  };

  const releaseOwnedId = (record: WebProjectorRecord) => {
    const target = record.ownedIdTarget;
    if (target && record.reservedId && target.id === record.reservedId)
      target.removeAttribute('id');
    record.ownedIdTarget = null;
  };

  const releaseReservation = (record: WebProjectorRecord) => {
    releaseOwnedId(record);
    const { objectRef, reservedDocument, reservedId } = record;
    if (objectRef && reservedDocument && reservedId) {
      const documentReservations = reservedIdsByDocument.get(reservedDocument);
      const reservation = documentReservations?.get(reservedId);
      if (reservation?.objectRef === objectRef && --reservation.count === 0) {
        documentReservations!.delete(reservedId);
        if (documentReservations!.size === 0) reservedIdsByDocument.delete(reservedDocument);
        const refReservations = reservedIdsByRef.get(objectRef);
        if (refReservations?.get(reservedDocument) === reservation) {
          refReservations.delete(reservedDocument);
          if (refReservations.size === 0) reservedIdsByRef.delete(objectRef);
        }
      }
    }
    record.reservedDocument = null;
    record.reservedId = null;
  };

  const clearProjection = (record: WebProjectorRecord, key: string) => {
    const projection = record.projections.get(key);
    if (!projection) return;
    const { target, attr, tokens } = projection;
    // Each recorded projection keeps its shared attribute ledger alive.
    const byAttribute = relationOwnerships.get(target)!;
    const ownership = byAttribute.get(attr)!;
    const currentValue = target.getAttribute(attr);
    const canRestore =
      ownership.projectedValue !== undefined && currentValue === ownership.projectedValue;
    const currentTokens = canRestore ? undefined : readTokens(currentValue);
    const remove = canRestore ? undefined : new Set<string>();
    for (const token of tokens) {
      const count = ownership.counts.get(token)! - 1;
      if (count) ownership.counts.set(token, count);
      else {
        ownership.counts.delete(token);
        if (!ownership.baseline.has(token) && currentTokens?.includes(token)) remove?.add(token);
      }
    }
    ownership.projections.delete(projection);
    if (canRestore) {
      const visible = [...ownership.baseline];
      let value: string | undefined;
      for (const owner of ownership.projections) {
        if (owner.mode === 'replace') {
          visible.length = 0;
          value = owner.value;
        } else value = undefined;
        visible.push(...owner.tokens);
      }
      if (value !== undefined) setOptionalAttr(target, attr, value);
      else setTokenListAttr(target, attr, visible);
      ownership.projectedValue = target.getAttribute(attr);
    } else {
      // Do not replay hidden contributions or an old baseline over host-authored output.
      if (remove?.size)
        setTokenListAttr(
          target,
          attr,
          currentTokens!.filter((token) => !remove.has(token))
        );
      ownership.projectedValue = undefined;
    }
    if (ownership.projections.size === 0) {
      byAttribute.delete(attr);
      if (byAttribute.size === 0) relationOwnerships.delete(target);
    }
    record.projections.delete(key);
  };

  const clearProjections = (record: WebProjectorRecord) => {
    for (const key of [...record.projections.keys()]) clearProjection(record, key);
  };

  const removeDependencies = (record: WebProjectorRecord) => {
    for (const ref of record.dependencyRefs) {
      const sources = dependentSourcesByRef.get(ref);
      if (!sources) continue;
      sources.delete(record);
      if (sources.size === 0) dependentSourcesByRef.delete(ref);
    }
    record.dependencyRefs.clear();
  };

  const updateDependencies = (record: WebProjectorRecord, snapshot: A11ySemanticObjectSnapshot) => {
    removeDependencies(record);
    for (const key of Object.keys(ARIA_RELATION_ATTRS)) {
      const relation = snapshot.relations[key];
      if (!Array.isArray(relation)) continue;
      for (const ref of relation) {
        if (!isA11ySemanticObjectRef(ref) || record.dependencyRefs.has(ref)) continue;
        record.dependencyRefs.add(ref);
        const sources = dependentSourcesByRef.get(ref) ?? new Set<WebProjectorRecord>();
        sources.add(record);
        dependentSourcesByRef.set(ref, sources);
      }
    }
  };

  const structuredRelationsChanged = (
    previous: A11ySemanticObjectSnapshot | null,
    next: A11ySemanticObjectSnapshot
  ) => {
    for (const key of Object.keys(ARIA_RELATION_ATTRS)) {
      const previousRelation = previous?.relations[key];
      const nextRelation = next.relations[key];
      const previousIsStructured = Array.isArray(previousRelation);
      const nextIsStructured = Array.isArray(nextRelation);
      if (previousIsStructured !== nextIsStructured) return true;
      if (!previousIsStructured || !nextIsStructured) continue;
      if (previousRelation.length !== nextRelation.length) return true;
      if (previousRelation.some((ref, index) => ref !== nextRelation[index])) return true;
      if (
        (previous?.relationModes?.[key] ?? 'replace') !== (next.relationModes?.[key] ?? 'replace')
      ) {
        return true;
      }
    }
    return false;
  };

  const idIsAvailable = (
    document: Document,
    id: string,
    target: HTMLElement,
    objectRef: A11ySemanticObjectRef
  ) => {
    const reservation = reservedIdsByDocument.get(document)?.get(id);
    if (reservation && reservation.objectRef !== objectRef) return false;
    for (const element of document.querySelectorAll<HTMLElement>('[id]')) {
      if (element.id === id && element !== target) return false;
    }
    return true;
  };

  const reserveId = (record: WebProjectorRecord, id: string) => {
    const { objectRef, target } = record;
    if (!objectRef || !target) return;
    const document = target.ownerDocument;
    const documentReservations = reservedIdsByDocument.get(document) ?? new Map();
    const reservation = documentReservations.get(id) ?? { id, objectRef, count: 0 };
    reservation.count += 1;
    documentReservations.set(id, reservation);
    reservedIdsByDocument.set(document, documentReservations);
    const refReservations = reservedIdsByRef.get(objectRef) ?? new Map();
    refReservations.set(document, reservation);
    reservedIdsByRef.set(objectRef, refReservations);
    record.reservedDocument = document;
    record.reservedId = id;
    record.lastTargetId = id;
  };

  const ensureTargetId = (record: WebProjectorRecord): string | null => {
    const { target, objectRef } = record;
    if (!target || !objectRef) return null;
    const document = target.ownerDocument;
    if (record.reservedDocument && record.reservedDocument !== document) {
      releaseReservation(record);
    }
    if (!record.reservedId) {
      const reservation = reservedIdsByRef.get(objectRef)?.get(document);
      if (reservation) {
        reservation.count += 1;
        record.reservedDocument = document;
        record.reservedId = reservation.id;
      }
    }

    if (record.reservedId) {
      if (target.id && target.id !== record.reservedId) return null;
      if (!idIsAvailable(document, record.reservedId, target, objectRef)) return null;
      if (!target.id) {
        target.id = record.reservedId;
        record.ownedIdTarget = target;
      }
      const refReservations = reservedIdsByRef.get(objectRef);
      if (refReservations?.get(document)?.id !== record.reservedId) {
        const current = refReservations ?? new Map();
        current.set(document, reservedIdsByDocument.get(document)!.get(record.reservedId)!);
        reservedIdsByRef.set(objectRef, current);
      }
      record.lastTargetId = record.reservedId;
      return record.reservedId;
    }

    if (target.id) {
      if (!idIsAvailable(document, target.id, target, objectRef)) return null;
      reserveId(record, target.id);
      return target.id;
    }

    let candidate = `${idPrefix}-${nextId++}`;
    while (!idIsAvailable(document, candidate, target, objectRef)) {
      candidate = `${idPrefix}-${nextId++}`;
    }
    target.id = candidate;
    record.ownedIdTarget = target;
    reserveId(record, candidate);
    return candidate;
  };

  const resolveTargets = (
    source: WebProjectorRecord,
    refs: readonly A11ySemanticObjectRef[]
  ): readonly string[] | null => {
    if (!source.target || refs.length === 0) return null;
    const ids: string[] = [];
    const seen = new Set<A11ySemanticObjectRef>();
    for (const ref of refs) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      const candidates = [...(recordsByRef.get(ref) ?? [])].filter(
        (record) => record.target?.ownerDocument === source.target?.ownerDocument
      );
      if (candidates.length !== 1) return null;
      const id = ensureTargetId(candidates[0]!);
      if (!id) return null;
      ids.push(id);
    }
    return ids;
  };

  const applyRelationProjection = (
    record: WebProjectorRecord,
    key: string,
    attr: string,
    mode: A11yRelationMode,
    tokens: readonly string[] | null,
    value?: string
  ) => {
    const current = record.projections.get(key);
    if (
      current &&
      current.target === record.target &&
      current.mode === mode &&
      current.value === value &&
      tokens &&
      current.tokens.length === tokens.length &&
      current.tokens.every((token, index) => token === tokens[index])
    )
      return;
    clearProjection(record, key);
    if (
      !record.target ||
      !tokens ||
      (tokens.length === 0 && (value === undefined || mode === 'append'))
    )
      return;

    const target = record.target;
    const previousValue = target.getAttribute(attr);
    const previousTokens = readTokens(previousValue);
    let byAttribute = relationOwnerships.get(target);
    if (!byAttribute) {
      byAttribute = new Map();
      relationOwnerships.set(target, byAttribute);
    }
    let ownership = byAttribute.get(attr);
    if (!ownership) {
      ownership = {
        baseline: new Set(),
        counts: new Map(),
        projections: new Set(),
        projectedValue: undefined,
      };
      byAttribute.set(attr, ownership);
    }
    if (previousValue !== ownership.projectedValue) {
      // Another live owner's token is never a newly discovered host baseline.
      const previousBaseline = ownership.baseline;
      ownership.baseline = new Set(
        previousTokens.filter(
          (token) => !ownership.counts.has(token) || previousBaseline.has(token)
        )
      );
    }
    const projection: RelationProjection = { target, attr, mode, tokens, value };
    for (const token of tokens) ownership.counts.set(token, (ownership.counts.get(token) ?? 0) + 1);
    ownership.projections.add(projection);
    if (mode === 'replace' && value !== undefined) setOptionalAttr(target, attr, value);
    else
      setTokenListAttr(target, attr, mode === 'append' ? [...previousTokens, ...tokens] : tokens);
    ownership.projectedValue = target.getAttribute(attr);
    record.projections.set(key, projection);
  };

  const reconcileSource = (record: WebProjectorRecord) => {
    const active = new Set<string>();
    if (record.target && record.snapshot) {
      for (const [key, attr] of Object.entries(ARIA_RELATION_ATTRS)) {
        const relation = record.snapshot.relations[key];
        if (!Array.isArray(relation)) continue;
        active.add(key);
        const refs = relation.filter(isA11ySemanticObjectRef);
        const tokens = refs.length === relation.length ? resolveTargets(record, refs) : null;
        applyRelationProjection(
          record,
          key,
          attr,
          record.snapshot.relationModes?.[key] ?? 'replace',
          tokens
        );
      }
    }
    for (const [key, projection] of record.projections) {
      if (projection.value === undefined && !active.has(key)) clearProjection(record, key);
    }
  };

  const reconcileDependents = (
    refs: ReadonlySet<A11ySemanticObjectRef>,
    alreadyReconciled?: WebProjectorRecord
  ) => {
    const affected = new Set<WebProjectorRecord>();
    for (const ref of refs) {
      for (const source of dependentSourcesByRef.get(ref) ?? []) affected.add(source);
    }
    if (alreadyReconciled) affected.delete(alreadyReconciled);
    for (const source of affected) reconcileSource(source);
  };

  const update = (
    record: WebProjectorRecord,
    snapshot: A11ySemanticObjectSnapshot,
    forceStructured = false
  ) => {
    if (record.disposed || record.detached) return;
    const nextTarget = record.getTarget();
    const nextDocument = nextTarget?.ownerDocument ?? record.targetDocument;
    const targetChanged = nextTarget !== record.target;
    const documentChanged = nextDocument !== record.targetDocument;
    const refChanged = snapshot.objectRef !== record.objectRef;
    const previousSnapshot = record.snapshot;
    const previousRef = record.objectRef;
    const previousTargetId = record.lastTargetId;
    const bindingReplaced = targetChanged || documentChanged || refChanged;
    const structuredChanged =
      forceStructured || bindingReplaced || structuredRelationsChanged(previousSnapshot, snapshot);

    const releasedIdRefs = releaseScalarAttributes(record);
    if (bindingReplaced) {
      clearProjections(record);
      unindex(record);
      releaseOwnedId(record);
      if (documentChanged || refChanged) releaseReservation(record);
    } else {
      for (const key of [...record.projections.keys()]) {
        if (!Array.isArray(snapshot.relations[key])) clearProjection(record, key);
      }
    }

    record.target = nextTarget;
    record.targetDocument = nextDocument;
    record.snapshot = snapshot;
    record.objectRef = snapshot.objectRef;
    if (structuredChanged) updateDependencies(record, snapshot);
    if (nextTarget) {
      const indexed = recordsByRef.get(snapshot.objectRef) ?? new Set<WebProjectorRecord>();
      indexed.add(record);
      recordsByRef.set(snapshot.objectRef, indexed);
      const attributes = acquireScalarAttributes(
        record,
        nextTarget,
        snapshot,
        bindingReplaced ? undefined : releasedIdRefs
      );
      // Registry ownership already released old values; skip stateless snapshot cleanup.
      applySnapshot(nextTarget, snapshot, undefined, attributes, false);
      for (const [key, attr] of Object.entries(ARIA_RELATION_ATTRS)) {
        if (!Object.prototype.hasOwnProperty.call(snapshot.relations, key)) continue;
        const relation = snapshot.relations[key];
        if (Array.isArray(relation)) continue;
        const value = typeof relation === 'string' ? relation : '';
        applyRelationProjection(
          record,
          key,
          attr,
          snapshot.relationModes?.[key] ?? 'replace',
          readTokens(value),
          value
        );
      }
    }

    const currentTargetId = nextTarget?.id || null;
    if (
      !targetChanged &&
      record.reservedId &&
      nextTarget &&
      currentTargetId !== previousTargetId &&
      currentTargetId !== record.reservedId
    ) {
      // Release only after a live id transition within the same binding.
      releaseReservation(record);
      if (
        currentTargetId &&
        idIsAvailable(nextTarget.ownerDocument, currentTargetId, nextTarget, snapshot.objectRef)
      ) {
        // A confirmed live host-ID change selects the new ID without revoking other leases.
        reserveId(record, currentTargetId);
      }
    }
    const bindingChanged =
      forceStructured || bindingReplaced || currentTargetId !== previousTargetId;
    record.lastTargetId = currentTargetId;
    if (structuredChanged) reconcileSource(record);
    const currentIdRefs =
      record.scalarAttributes.has('id') && nextTarget
        ? scalarAttributeRefs.get(nextTarget)?.get('id')?.affectedIdRefs
        : undefined;
    if (bindingChanged || releasedIdRefs || currentIdRefs) {
      const affectedRefs = new Set<A11ySemanticObjectRef>(releasedIdRefs);
      if (currentIdRefs && currentIdRefs !== releasedIdRefs) {
        for (const ref of currentIdRefs) affectedRefs.add(ref);
      }
      if (previousRef) affectedRefs.add(previousRef);
      affectedRefs.add(snapshot.objectRef);
      reconcileDependents(affectedRefs, structuredChanged ? record : undefined);
    }
  };

  return {
    createProjector(getTarget, subscribeTargetChange) {
      const record: WebProjectorRecord = {
        getTarget,
        target: null,
        targetDocument: null,
        snapshot: null,
        objectRef: null,
        reservedId: null,
        reservedDocument: null,
        ownedIdTarget: null,
        lastTargetId: null,
        scalarAttributes: new Map(),
        dependencyRefs: new Set(),
        projections: new Map(),
        detached: false,
        disposed: false,
      };
      const onTargetChange = () => {
        if (record.snapshot) update(record, record.snapshot);
      };
      let unsubscribe = subscribeTargetChange?.(onTargetChange);
      let needsReplay = false;
      const detach = (removeOwned = false) => {
        if (record.disposed || record.detached) return;
        const affectedRef = record.objectRef;
        const releasedIdRefs = releaseScalarAttributes(record, removeOwned);
        record.detached = true;
        unsubscribe?.();
        unsubscribe = undefined;
        clearProjections(record);
        removeDependencies(record);
        unindex(record);
        releaseOwnedId(record);
        if (affectedRef || releasedIdRefs) {
          const affectedRefs = new Set(releasedIdRefs);
          if (affectedRef) affectedRefs.add(affectedRef);
          reconcileDependents(affectedRefs);
        }
      };
      const projector: A11yProjector = (snapshot) => {
        if (record.disposed || record.detached) return;
        const replay = needsReplay;
        needsReplay = false;
        update(record, snapshot, replay);
        if (!unsubscribe) unsubscribe = subscribeTargetChange?.(onTargetChange);
      };
      projector.detach = detach;
      projector.reactivate = () => {
        if (record.disposed || !record.detached) return;
        record.detached = false;
        // Resume only after the Module supplies its current snapshot, never a stale cache.
        needsReplay = true;
      };
      projector.clearHeadingLevel = () => {
        if (record.snapshot && hasProjectedHeadingLevel(record.snapshot)) {
          releaseScalarAttribute(record, 'aria-level');
          // Target notifications may replay only the still-valid cached projection.
          record.snapshot = { ...record.snapshot, level: undefined };
        }
      };
      projector.dispose = () => {
        if (record.disposed) return;
        const releasedIdRefs = record.detached ? releaseScalarAttributes(record, true) : undefined;
        if (!record.detached) detach(true);
        record.disposed = true;
        releaseReservation(record);
        record.snapshot = null;
        record.target = null;
        record.targetDocument = null;
        record.lastTargetId = null;
        record.objectRef = null;
        if (releasedIdRefs) reconcileDependents(releasedIdRefs);
      };
      return projector;
    },
  };
}

const DEFAULT_WEB_A11Y_PROJECTION_REGISTRY = createWebA11yProjectionRegistry();

export function createWebA11yProjector(
  target: HTMLElement | (() => HTMLElement | null),
  subscribeTargetChange?: (listener: () => void) => () => void,
  registry: WebA11yProjectionRegistry = DEFAULT_WEB_A11Y_PROJECTION_REGISTRY
): A11yProjector {
  const getTarget = typeof target === 'function' ? target : () => target;
  return registry.createProjector(getTarget, subscribeTargetChange);
}

function hasProjectedHeadingLevel(snapshot: A11ySemanticObjectSnapshot): boolean {
  const level = snapshot.level;
  return (
    snapshot.role === 'heading' &&
    typeof level === 'number' &&
    Number.isInteger(level) &&
    level >= 1 &&
    level <= 6
  );
}
function projectedScalarAttributes(
  snapshot: A11ySemanticObjectSnapshot,
  includeRelations = true
): ScalarAttributes {
  const attrs: ScalarAttributes = new Map();
  if (snapshot.id !== undefined) attrs.set('id', snapshot.id || undefined);
  if (snapshot.role !== undefined) attrs.set('role', snapshot.role || undefined);
  if (hasProjectedHeadingLevel(snapshot)) attrs.set('aria-level', String(snapshot.level));
  if (snapshot.name) {
    attrs.set(
      'aria-label',
      snapshot.name.kind === 'text' ? readTextTarget(snapshot.name.value) || undefined : undefined
    );
  }
  if (snapshot.description) {
    attrs.set(
      'aria-description',
      snapshot.description.kind === 'text'
        ? readTextTarget(snapshot.description.value) || undefined
        : undefined
    );
  }
  for (const [key, attr] of Object.entries(ARIA_STATE_ATTRS)) {
    if (Object.prototype.hasOwnProperty.call(snapshot.states, key)) {
      attrs.set(attr, projectedAttributeValue(snapshot.states[key]));
    }
  }
  if (Object.prototype.hasOwnProperty.call(snapshot.states, 'hidden')) {
    attrs.set('aria-hidden', projectedAttributeValue(snapshot.states.hidden));
    attrs.set('hidden', snapshot.states.hidden === true ? '' : undefined);
  }
  if (includeRelations) {
    for (const [key, attr] of Object.entries(ARIA_RELATION_ATTRS)) {
      if (!Object.prototype.hasOwnProperty.call(snapshot.relations, key)) continue;
      const relation = snapshot.relations[key];
      if (!Array.isArray(relation) && snapshot.relationModes?.[key] !== 'append') {
        attrs.set(attr, typeof relation === 'string' ? relation || undefined : undefined);
      }
    }
  }
  const actionKeys = Object.keys(snapshot.actions).sort();
  if (actionKeys.length) attrs.set('data-pui-a11y-actions', actionKeys.join(' ') || undefined);
  if (snapshot.tree) {
    if (Object.prototype.hasOwnProperty.call(snapshot.tree, 'hidden')) {
      attrs.set('aria-hidden', projectedAttributeValue(snapshot.tree.hidden));
    }
    if (Object.prototype.hasOwnProperty.call(snapshot.tree, 'mergeChildren')) {
      attrs.set(
        'data-pui-a11y-merge-children',
        projectedAttributeValue(snapshot.tree.mergeChildren)
      );
    }
  }
  return attrs;
}

export function clearWebA11ySnapshot(el: HTMLElement, snapshot: A11ySemanticObjectSnapshot): void {
  if (typeof snapshot.id !== 'undefined') el.removeAttribute('id');
  if (typeof snapshot.role !== 'undefined') el.removeAttribute('role');
  if (hasProjectedHeadingLevel(snapshot)) el.removeAttribute('aria-level');
  if (snapshot.name) el.removeAttribute('aria-label');
  if (snapshot.description) el.removeAttribute('aria-description');

  for (const [key, attr] of Object.entries(ARIA_STATE_ATTRS)) {
    if (Object.prototype.hasOwnProperty.call(snapshot.states, key)) el.removeAttribute(attr);
  }
  if (Object.prototype.hasOwnProperty.call(snapshot.states, 'hidden')) {
    el.removeAttribute('aria-hidden');
    el.removeAttribute('hidden');
  }
  for (const [key, attr] of Object.entries(ARIA_RELATION_ATTRS)) {
    if (!Object.prototype.hasOwnProperty.call(snapshot.relations, key)) continue;
    if (Array.isArray(snapshot.relations[key])) continue;
    if (snapshot.relationModes?.[key] === 'append') {
      setTokenListAttr(
        el,
        attr,
        withoutTokens(readTokens(el.getAttribute(attr)), relationTokens(snapshot, key))
      );
    } else {
      el.removeAttribute(attr);
    }
  }
  if (Object.keys(snapshot.actions).length) el.removeAttribute('data-pui-a11y-actions');
  if (snapshot.tree) {
    if (Object.prototype.hasOwnProperty.call(snapshot.tree, 'hidden')) {
      el.removeAttribute('aria-hidden');
    }
    if (Object.prototype.hasOwnProperty.call(snapshot.tree, 'mergeChildren')) {
      el.removeAttribute('data-pui-a11y-merge-children');
    }
  }
}

function projectedAttributeValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
}

export function applyWebA11ySnapshot(
  el: HTMLElement,
  snapshot: A11ySemanticObjectSnapshot,
  previousSnapshot?: A11ySemanticObjectSnapshot
): void {
  applySnapshot(el, snapshot, previousSnapshot, projectedScalarAttributes(snapshot));
}

function applySnapshot(
  el: HTMLElement,
  snapshot: A11ySemanticObjectSnapshot,
  previousSnapshot: A11ySemanticObjectSnapshot | undefined,
  attributes: ScalarAttributes,
  includeRelations = true
): void {
  for (const [attr, value] of attributes) {
    if (value === undefined) el.removeAttribute(attr);
    else el.setAttribute(attr, value);
  }
  if (
    !attributes.has('aria-level') &&
    previousSnapshot &&
    hasProjectedHeadingLevel(previousSnapshot)
  ) {
    el.removeAttribute('aria-level');
  }
  if (!includeRelations) return;
  for (const [key, attr] of Object.entries(ARIA_RELATION_ATTRS)) {
    if (
      Object.prototype.hasOwnProperty.call(snapshot.relations, key) &&
      !Array.isArray(snapshot.relations[key]) &&
      snapshot.relationModes?.[key] === 'append'
    ) {
      const previousOwned =
        previousSnapshot?.relationModes?.[key] === 'append'
          ? relationTokens(previousSnapshot, key)
          : [];
      setTokenListAttr(el, attr, [
        ...withoutTokens(readTokens(el.getAttribute(attr)), previousOwned),
        ...relationTokens(snapshot, key),
      ]);
    }
  }
}

function relationTokens(snapshot: A11ySemanticObjectSnapshot, key: string): string[] {
  return readTokens(snapshot.relations[key]);
}

function readTokens(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return [...new Set(value.trim().split(/\s+/).filter(Boolean))];
}

function withoutTokens(current: string[], removed: string[]): string[] {
  const removal = new Set(removed);
  return current.filter((token) => !removal.has(token));
}

function setTokenListAttr(el: HTMLElement, attr: string, tokens: readonly string[]): void {
  setOptionalAttr(el, attr, [...new Set(tokens)].join(' '));
}

function setOptionalAttr(el: HTMLElement, attr: string, value: string | undefined): void {
  if (value === undefined || value === '') {
    el.removeAttribute(attr);
    return;
  }
  el.setAttribute(attr, value);
}

function readTextTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { get?: unknown }).get === 'function'
  ) {
    const next = (value as { get(): unknown }).get();
    return typeof next === 'string' ? next : undefined;
  }
  return undefined;
}
