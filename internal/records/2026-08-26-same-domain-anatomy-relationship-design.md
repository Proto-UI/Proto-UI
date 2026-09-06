# Same-domain anatomy-part relationship design

Non-normative record. Refs #549 and #388. This record explains the draft contract direction cataloged by `C-A11Y-PART-RELATIONSHIP-0001`; the record itself does not amend `spec/**`, add a public API, describe an implemented capability, create a stable guarantee, or authorize merge.

## Problem and governing direction

Disclosure, Collapsible, Accordion, and Tabs need a reusable same-domain relationship in which one logical part refers to another, for example Trigger `controls` Content. The relationship must:

1. be declared from anatomy family, source and target roles, same-domain scope, relation semantic, and a protocol match key;
2. preserve target identity across L1 detach while removing host IDREF projection when no target view is materialized;
3. restore the same reserved host identity before a rematerialized target is revealed;
4. fail closed for zero or multiple matches instead of guessing; and
5. release runtime records, observers, host attributes, and reserved identity on terminal disposal.

The applicable draft contract authority is `C-A11Y-PART-RELATIONSHIP-0001`; upstream direction remains recorded by `D-A11Y-PART-RELATIONSHIP-PROJECTION-0001`. In particular, contract criteria A–C and decision criteria B–D require a structured relationship carrier and leave stable, unique host-ID generation plus missing/duplicate/dynamic fallback to the Web adapter. Existing `def.a11y.relation()` accepts only a string or `State<string>` target. Existing `AnatomyClaimDecl` contains only `role` and optional `profile`, and `AnatomyRelation` currently expresses only `contains`. None of those existing surfaces implements the governed semantics today.

## Candidate structured carrier — not an existing API

`C-A11Y-PART-RELATIONSHIP-0001-A` governs the minimum runtime carrier fields. Exact public syntax remains an implementation choice, but the carrier must preserve at least:

- anatomy family and opaque same-domain scope identity;
- source part instance identity and source role;
- relation semantic such as `controls` or `labelledBy`;
- target role;
- protocol match key, kept distinct from host ID; and
- the source and target view epochs needed to reject stale projection work.

Illustrative names such as `def.a11y.partRelation(...)`, an extended anatomy claim, or a module-internal declaration type are not current APIs. Any implementation must first align the Core declaration and IR schemas, public types, Runtime/A11y owner, and adapter seam with `C-A11Y-PART-RELATIONSHIP-0001`; an adapter-generated host ID must not be written back into prototype-owned `State<string>` merely to imitate the structured carrier.

## Runtime/A11y projection ownership and presence

Presence must not be stored in portable Tabs/Disclosure Context. `C-ANATOMY-0001` also forbids treating Anatomy as an instance registry, so Anatomy cannot own the relationship table. The candidate needs a separately governed Runtime/A11y relationship-projection service that consumes only Anatomy-provided structural declarations, opaque same-domain scope, and module-internal target-readiness signals. That service, not Anatomy, owns the bounded relationship lease entries:

1. Every claimed source or target is retained as a distinct opaque instance entry. Multiplicity is never collapsed to a boolean or a single value-keyed slot.
2. Match keys are fields on entries, not property names on a plain JavaScript object. An internal `Map` or equivalent entry list therefore treats unrestricted strings such as `__proto__` and `constructor` as ordinary data without prototype-key hazards. No such registry is serialized into portable Context.
3. Target materialization is derived from the module-internal target binding for the current view epoch. L1 detach marks that instance unavailable for projection but does not delete its logical instance or reserved adapter identity.
4. Each adapter-facing lease carries the relation semantic, declared projection mode, exact host token contribution, and per-attribute ownership/reference ledger. If an identical token existed before acquisition, the lease records a reference without taking exclusive ownership; detach, re-index, replacement, and disposal remove a token only after the host-authored baseline and every independent or lease reference are absent. An exclusive projection, if a future admitted semantic needs one, must declare that mode explicitly and still must not erase a value it no longer owns.
5. Domain-scope movement, target replacement, live host-id mutation, detach, rematerialization, and terminal disposal invalidate stale work and notify the adapter-facing relationship projection lease. Anatomy remains the structural/domain source and never becomes the owner of retained relationship instances.

This is a bounded projection service at the Runtime/A11y boundary, not an Anatomy registry or a general information channel. Prototype authors receive neither registry access nor host targets, host IDs, framework keys, or raw geometry.

## Matching, duplicates, and dynamic re-keying

For each source relationship, the adapter-facing resolver filters entries by the full tuple `(anatomy family, opaque domain scope/root instance, target role, exact protocol match key)`. Anatomy family is part of identity even when two families share the same root instance, role names, and key; entries from those families must never match or create duplicate ambiguity for one another.

- exactly one logical target and one current materialized target view: project the reserved host ID;
- no logical match, no materialized view, or a stale epoch: remove only the lease-owned source IDREF token and retain any host-authored or independently owned tokens plus any still-valid logical reservation;
- multiple logical or materialized matches: remove only the lease-owned source IDREF token, preserve all unowned tokens, emit a bounded diagnostic, and do not choose by DOM order, registration order, prototype name, or value escaping.

Any mutable resolver-tuple field may change while an instance is alive. At minimum, a host-tree move can change the opaque anatomy domain scope and a prop update can change the exact protocol match key. A retained declaration therefore needs one atomic re-index operation: remove the instance from its previous tuple and insert it under the new tuple as one registry transaction, then invalidate both old and new projections. Equality is checked before publication. This prevents recursive no-op updates, cross-domain residue, and temporary exposure of one instance under two tuples. Duplicate ambiguity remains visible as multiplicity and is resolved only by the adapter's fail-closed rule.

No unconditional `ContextCenter.update()` loop is part of this design. If an admitted implementation uses any subscription callback, it must suppress an unchanged structured snapshot and must not synchronously write the same source that triggered the callback.

## Host identity and projection lifecycle

The Web adapter, not Anatomy and not prototype State, owns the mapping from a logical target-instance identity to a stable unique host ID, subject to the non-destructive host-id policy in `C-A11Y-PART-RELATIONSHIP-0001-J`.

- First materialization: inspect the target's existing host `id`. Adopt it unchanged only when it is non-empty, unique in the applicable host scope, and not reserved by another logical target. Otherwise preserve any authored value and fail closed on a collision; when no adoptable id exists, assign a unique reserved id while recording the exact prior per-view value and adapter ownership.
- L1 detach: withdraw each lease-owned source IDREF contribution before the target-removal host commit becomes visible while retaining the logical relationship and reserved target-instance identity. A per-attribute ownership/reference ledger preserves every unowned contribution, including an identical token that existed before lease acquisition; remove a token only after no host-authored baseline, independent owner, or lease reference remains, and remove the attribute only when no tokens remain.
- Source or target materialization/rematerialization: bind every new source or target view epoch to its retained logical instance. Once both current bindings form one valid match, bind the target reservation and restore reciprocal IDREFs before the corresponding new epoch's host commit becomes visible. A rematerialized target carrying a different authored id is preserved and fails closed rather than being overwritten.
- Live host-id mutation: preserve the author's new target `id`, immediately invalidate the old reservation and dependent source IDREF contributions, and only then re-adopt or rebind after the full uniqueness/reservation collision check. No source may retain the stale IDREF while reconciliation is pending.
- Same-epoch physical binding replacement: revoke old-view lease ownership and observers, bind the new source or target view, revalidate the reservation, and re-resolve dependents inside the same host replacement transaction. Project the valid relationship before the new accessibility binding is visible or fail closed.
- Terminal disposal: remove every target registry membership, source lease, dependent projection binding, and observer owned by or retaining the disposed logical instance; invalidate affected sources before the adapter clears lease-owned host values and releases its reservation. A per-view prior id is restored or removed only when the current value still equals the lease-owned id, so cleanup never overwrites a later author mutation. No `State<string>.set(null)` is prescribed. Empty string remains valid only for existing optional string projections, not as the ownership mechanism for this structured relationship.

The current runtime invokes `host.commit` before `afterRenderCommit` and mounted callbacks, so neither hook can satisfy source/target before-visible-commit, detach-before-removal, or same-epoch replacement ordering. An admitted design needs an explicit adapter/runtime host-transaction seam: once current source and target bindings exist, matching, target-ID reservation, source IDREF reconciliation, detach withdrawal, and old-view revocation complete before the corresponding commit or replacement becomes accessibility-visible. Existing `subscribeTargets` is evidence of module-internal readiness notification, not proof that this ordering already exists. Detach/dispose must revoke the seam and every associated observer.

## Tabs migration boundary

Tabs is migration evidence and a second consumer, not the source of a Tabs-only patch. Today Tabs derives strings with `createTabsPartId()` and sends them through `def.a11y.relation()`. Migration would instead declare reciprocal structured relationships:

- Trigger(value=x) `controls` Content(value=x);
- Content(value=x) `labelledBy` Trigger(value=x).

Root continues to own selection facts through Context, but Context gains no presence table or host identifier. Trigger and Content value changes drive the atomic runtime re-key described above. Inactive lazy Content demonstrates L1 detach/rematerialization; duplicate and missing values demonstrate adapter fail-closed behavior. Existing Tabs string IDs remain current implementation evidence until the structured capability and migration are admitted and landed together.

## Required catalog and schema work

`C-A11Y-PART-RELATIONSHIP-0001` supplies the draft machine-governed contract authority, and `T-A11Y-PART-RELATIONSHIP-0001` maps its acceptance cases to existing cross-layer test paths with explicit `planned` status. Before implementation can satisfy either entity, the executable slice must still:

- extend the Core Anatomy/A11y declaration and IR schemas with the structured carrier rather than pretending current `AnatomyClaimDecl`, `AnatomyRelation`, or `def.a11y.relation()` already supports it;
- revise the existing A11y Module and Host Capability entities to own the separately governed Runtime/A11y relationship-projection service, scoped lease table, atomic tuple re-indexing, source/target epochs, diagnostics, host-transaction ordering, complete cleanup, and non-destructive live host-id/token ownership while keeping Anatomy limited to structured declaration, domain scope, and readiness signals under `C-ANATOMY-0001`;
- implement the planned Runtime, Web Component, Base Tabs, React, Vue 3, and Vue 2 mappings in `T-A11Y-PART-RELATIONSHIP-0001` and promote their status only when their executable evidence passes; and
- revise Tabs prototype mappings without changing unrelated stable guarantees.

All new or revised entities remain governed by their declared lifecycle status. This record cannot turn a draft decision into an active guarantee.

## Executable evidence

- Schema/type tests reject incomplete or host-specific declarations and prove protocol match keys are not host IDs.
- Runtime/module tests cover independent same-family domains, same-root multi-family isolation, zero/one/multiple matches, arbitrary string keys including `__proto__` and `constructor`, target replacement, stale source and target epochs, live domain-scope movement, detach/rematerialization, and terminal disposal. The multi-family case uses identical root identity, target role, and protocol key and proves the family-qualified resolver never cross-matches or reports false duplicate ambiguity.
- Re-index tests change a mounted target from value A to B and move a live part from domain A to B, proving one atomic old/new tuple transaction, no reentrant dispatch, old-source IDREF removal, new-source restoration, duplicate ambiguity preservation, and no cross-domain residue.
- Host-transaction tests independently materialize/rematerialize source and target, detach the target, and replace source/target physical bindings in the same epoch. They prove relationship restoration before mount visibility, IDREF withdrawal before target removal, old-view ownership revocation, and valid new-view projection before replacement visibility; mounted or `afterRenderCommit`-only implementations must fail these tests.
- Web adapter tests prove unique stable ID ownership, collision-free adoption of a host-authored target id, immediate stale-IDREF withdrawal after live target-id mutation, fail-closed preservation of colliding or different authored ids, per-view compare-and-restore behavior, missing/duplicate fail-closed matching, reservation reuse across L1 detach, and complete release on terminal disposal. Additive-IDREF cases begin with both distinct and identical host-authored tokens, then prove detach, ambiguity, re-index, replacement, and terminal cleanup remove a token only when no owner/reference remains.
- Tabs migration tests cover reciprocal Trigger/Content relationships for lazy and `keepMounted` Content without adding presence or IDs to `TABS_CONTEXT`.
- Browser evidence exercises the Web Component, React, Vue 3, and active Vue 2 adapters separately. Disclosure/Collapsible/Accordion remain outside this prerequisite implementation slice except as future consumers of the admitted reusable contract.

## Status

This remains a non-normative design record. `C-A11Y-PART-RELATIONSHIP-0001` is the applicable draft contract authority and `T-A11Y-PART-RELATIONSHIP-0001` is its planned evidence map, but no public same-domain relationship API or implemented capability exists until the structured declaration, Runtime/A11y ownership, host-transaction seam, adapter identity/token ownership, executable mapped tests, and Tabs migration land together. Existing string-based relation behavior remains current implementation evidence and this proposal must not be presented as a completed or stable guarantee.
