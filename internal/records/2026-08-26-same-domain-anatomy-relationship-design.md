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
4. Each adapter-facing lease carries the relation semantic, its declared projection mode, and the exact host token or attribute value owned by that lease. Additive IDREF projection owns only its generated token: detach, re-key, replacement, and disposal remove that token while preserving host-authored and other independently owned tokens in the same attribute. An exclusive projection, if a future admitted semantic needs one, must declare that mode explicitly and still must not erase a value it no longer owns.
5. Target replacement, detach, rematerialization, and terminal disposal invalidate stale epoch work and notify the adapter-facing relationship projection lease. Anatomy remains the structural/domain source and never becomes the owner of these retained relationship instances.

This is a bounded projection service at the Runtime/A11y boundary, not an Anatomy registry or a general information channel. Prototype authors receive neither registry access nor host targets, host IDs, framework keys, or raw geometry.

## Matching, duplicates, and dynamic re-keying

For each source relationship, the adapter-facing resolver filters entries by the full tuple `(anatomy family, opaque domain scope/root instance, target role, exact protocol match key)`. Anatomy family is part of identity even when two families share the same root instance, role names, and key; entries from those families must never match or create duplicate ambiguity for one another.

- exactly one logical target and one current materialized target view: project the reserved host ID;
- no logical match, no materialized view, or a stale epoch: remove only the lease-owned source IDREF token and retain any host-authored or independently owned tokens plus any still-valid logical reservation;
- multiple logical or materialized matches: remove only the lease-owned source IDREF token, preserve all unowned tokens, emit a bounded diagnostic, and do not choose by DOM order, registration order, prototype name, or value escaping.

Match keys may change while an instance is mounted. A retained declaration therefore needs an atomic re-key operation: remove the instance from its previous match tuple and insert it under the new tuple as one registry transaction, then invalidate both old-key and new-key projections. Equality is checked before publishing the change. This prevents recursive no-op updates and ensures no Trigger temporarily observes the same instance under both keys. Duplicate ambiguity remains visible as multiplicity and is resolved only by the adapter's fail-closed rule.

No unconditional `ContextCenter.update()` loop is part of this design. If an admitted implementation uses any subscription callback, it must suppress an unchanged structured snapshot and must not synchronously write the same source that triggered the callback.

## Host identity and projection lifecycle

The Web adapter, not Anatomy and not prototype State, owns the mapping from a logical target-instance identity to a stable unique host ID, subject to the non-destructive host-id policy in `C-A11Y-PART-RELATIONSHIP-0001-J`.

- First materialization: inspect the target's existing host `id`. Adopt it unchanged only when it is non-empty, unique in the applicable host scope, and not reserved by another logical target. Otherwise preserve any authored value and fail closed on a collision; when no adoptable id exists, assign a unique reserved id while recording the exact prior per-view value and adapter ownership.
- L1 detach: withdraw each lease-owned source IDREF token while retaining the logical relationship, reserved target-instance identity, and every unowned token in the host attribute; remove the attribute itself only when no tokens remain.
- Source or target materialization/rematerialization: bind every new source or target view epoch to its retained logical instance. Once both current bindings form one valid match, bind the target reservation and restore reciprocal IDREFs before the corresponding new epoch's host commit becomes visible. A rematerialized target carrying a different authored id is preserved and fails closed rather than being overwritten.
- Terminal disposal: remove every target registry membership, source lease, dependent projection binding, and observer owned by or retaining the disposed logical instance; invalidate affected sources before the adapter clears lease-owned host values and releases its reservation. A per-view prior id is restored or removed only when the current value still equals the lease-owned id, so cleanup never overwrites a later author mutation. No `State<string>.set(null)` is prescribed. Empty string remains valid only for existing optional string projections, not as the ownership mechanism for this structured relationship.

The current runtime invokes `host.commit` before `afterRenderCommit` and mounted callbacks, so neither hook can satisfy the new-source or new-target before-visible-commit guarantee. An admitted design needs an explicit adapter/runtime pre-commit integration seam: once current source and target bindings for the new view epoch exist, relationship matching, target ID assignment, and source IDREF projection must complete before that epoch's host commit becomes visible. Existing `subscribeTargets` is evidence of module-internal readiness notification, not proof that this pre-commit ordering already exists. Detach/dispose must revoke the seam and every associated observer.

## Tabs migration boundary

Tabs is migration evidence and a second consumer, not the source of a Tabs-only patch. Today Tabs derives strings with `createTabsPartId()` and sends them through `def.a11y.relation()`. Migration would instead declare reciprocal structured relationships:

- Trigger(value=x) `controls` Content(value=x);
- Content(value=x) `labelledBy` Trigger(value=x).

Root continues to own selection facts through Context, but Context gains no presence table or host identifier. Trigger and Content value changes drive the atomic runtime re-key described above. Inactive lazy Content demonstrates L1 detach/rematerialization; duplicate and missing values demonstrate adapter fail-closed behavior. Existing Tabs string IDs remain current implementation evidence until the structured capability and migration are admitted and landed together.

## Required catalog and schema work

`C-A11Y-PART-RELATIONSHIP-0001` now supplies the draft machine-governed contract authority. Before implementation can satisfy it, the executable slice must still:

- extend the Core Anatomy/A11y declaration and IR schemas with the structured carrier rather than pretending current `AnatomyClaimDecl`, `AnatomyRelation`, or `def.a11y.relation()` already supports it;
- revise the existing A11y Module and Host Capability entities to own the separately governed Runtime/A11y relationship-projection service, scoped lease table, atomic re-keying, source/target epochs, diagnostics, terminal cleanup, and non-destructive host-id reservation while keeping Anatomy limited to structured declaration, domain scope, and readiness signals under `C-ANATOMY-0001`;
- add test entities and real executable mappings for pre-commit source/target projection, fail-closed matching, collision-free host-id adoption and compare-and-restore cleanup; and
- revise Tabs prototype/test mappings plus the reusable Disclosure/Collapsible/Accordion prerequisite mapping without changing unrelated stable guarantees.

All new or revised entities remain governed by their declared lifecycle status. This record cannot turn a draft decision into an active guarantee.

## Executable evidence

- Schema/type tests reject incomplete or host-specific declarations and prove protocol match keys are not host IDs.
- Runtime/module tests cover independent same-family domains, same-root multi-family isolation, zero/one/multiple matches, arbitrary string keys including `__proto__` and `constructor`, target replacement, stale source and target epochs, detach/rematerialization, and terminal disposal. The multi-family case uses identical root identity, target role, and protocol key and proves the family-qualified resolver never cross-matches or reports false duplicate ambiguity.
- Re-key tests change a mounted target from value A to B and prove one atomic removal/insertion, no reentrant dispatch, old-source IDREF removal, new-source restoration, and duplicate ambiguity preservation.
- Pre-commit tests independently rematerialize the source and target, proving each new epoch binds its current logical instance, assigns or adopts the target reservation, and restores reciprocal relationships before the corresponding commit becomes visible; mounted or `afterRenderCommit`-only implementations must fail these tests.
- Web adapter tests prove unique stable ID ownership, collision-free adoption of a host-authored target id, fail-closed preservation of colliding or different authored ids, per-view compare-and-restore behavior, missing/duplicate fail-closed matching, reservation reuse across L1 detach, and complete release on terminal disposal. Additive-IDREF cases begin with host-authored and independently owned tokens, then prove detach, ambiguity, re-key, replacement, and terminal cleanup remove only the Proto-generated lease token and remove the host attribute only when it is truly empty.
- Tabs migration tests cover reciprocal Trigger/Content relationships for lazy and `keepMounted` Content without adding presence or IDs to `TABS_CONTEXT`.
- Browser evidence exercises the Web Component, React, Vue 3, and active Vue 2 adapters separately. Disclosure/Collapsible/Accordion remain outside this prerequisite implementation slice except as future consumers of the admitted reusable contract.

## Status

This remains a non-normative design record. `C-A11Y-PART-RELATIONSHIP-0001` is the applicable draft contract authority, but no public same-domain relationship API or implemented capability exists until the structured declaration, Runtime/A11y ownership, source/target pre-commit seam, adapter reservation policy, test mappings, and Tabs migration land together. Existing string-based relation behavior remains current implementation evidence and this proposal must not be presented as a completed or stable guarantee.
