# Same-domain anatomy-part relationship design

Non-normative record. Refs #549 and #388. This record catalogs a candidate design for the accepted prerequisite; it does not amend `spec/**`, add a public API, describe an implemented capability, create a stable guarantee, or authorize merge by itself.

## Problem and governing direction

Disclosure, Collapsible, Accordion, and Tabs need a reusable same-domain relationship in which one logical part refers to another, for example Trigger `controls` Content. The relationship must:

1. be declared from anatomy family, source and target roles, same-domain scope, relation semantic, and a protocol match key;
2. preserve target identity across L1 detach while removing host IDREF projection when no target view is materialized;
3. restore the same reserved host identity before a rematerialized target is revealed;
4. fail closed for zero or multiple matches instead of guessing; and
5. release runtime records, observers, host attributes, and reserved identity on terminal disposal.

The applicable draft authority is `D-A11Y-PART-RELATIONSHIP-PROJECTION-0001`. In particular, criteria B–D require a structured relationship carrier and leave stable, unique host-ID generation plus missing/duplicate/dynamic fallback to the Web adapter. Existing `def.a11y.relation()` accepts only a string or `State<string>` target. Existing `AnatomyClaimDecl` contains only `role` and optional `profile`, and `AnatomyRelation` currently expresses only `contains`. None of those existing surfaces can carry the proposed semantics today.

## Candidate structured carrier — not an existing API

A future catalog amendment must admit a typed relationship declaration. Exact syntax remains an implementation choice, but the runtime carrier must preserve at least:

- anatomy family and opaque same-domain scope identity;
- source part instance identity and source role;
- relation semantic such as `controls` or `labelledBy`;
- target role;
- protocol match key, kept distinct from host ID; and
- the source and target view epochs needed to reject stale projection work.

Illustrative names such as `def.a11y.partRelation(...)`, an extended anatomy claim, or a module-internal declaration type are not current APIs and must not be implemented from this record without first updating the governing contract/schema and public types. The current string-based `def.a11y.relation()` remains the legacy projection surface; an adapter-generated host ID must not be written back into a prototype-owned `State<string>` merely to imitate the structured carrier.

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

The Web adapter, not Anatomy and not prototype State, owns the mapping from a logical target-instance identity to a stable unique host ID.

- First materialization: reserve or retrieve the target instance's host ID, assign it to the target, and project matching source IDREFs.
- L1 detach: withdraw each lease-owned source IDREF token while retaining the logical relationship, reserved target-instance identity, and every unowned token in the host attribute; remove the attribute itself only when no tokens remain.
- Rematerialization: bind the new target view epoch to the same logical target instance and reserved host ID, then restore reciprocal IDREFs.
- Terminal disposal: the relationship registry removes the instance entry; the adapter clears only values owned by its leases, preserves host-authored and independently owned values, and releases its reservation. No `State<string>.set(null)` is prescribed. Empty string remains valid only for existing optional string projections, not as the ownership mechanism for this structured relationship.

The current runtime invokes mounted callbacks after the mount render/commit, so `onMounted` cannot satisfy before-reveal restoration. An admitted design needs an explicit adapter/runtime pre-commit integration seam: once current source/target bindings for the new view epoch exist, relationship matching, target ID assignment, and source IDREF projection must complete before that epoch's host commit becomes visible. Existing `subscribeTargets` is evidence of module-internal readiness notification, not proof that this pre-commit ordering already exists. Detach/dispose must revoke the seam and all observers.

## Tabs migration boundary

Tabs is migration evidence and a second consumer, not the source of a Tabs-only patch. Today Tabs derives strings with `createTabsPartId()` and sends them through `def.a11y.relation()`. Migration would instead declare reciprocal structured relationships:

- Trigger(value=x) `controls` Content(value=x);
- Content(value=x) `labelledBy` Trigger(value=x).

Root continues to own selection facts through Context, but Context gains no presence table or host identifier. Trigger and Content value changes drive the atomic runtime re-key described above. Inactive lazy Content demonstrates L1 detach/rematerialization; duplicate and missing values demonstrate adapter fail-closed behavior. Existing Tabs string IDs remain current implementation evidence until the structured capability and migration are admitted and landed together.

## Required catalog and schema work

Before implementation, the accepted prerequisite must be projected into machine-governed authority. At minimum:

- refine or promote `D-A11Y-PART-RELATIONSHIP-PROJECTION-0001` into the appropriate contract and criteria;
- extend the core Anatomy/A11y declaration and IR schemas with the structured carrier rather than pretending current `AnatomyClaimDecl`, `AnatomyRelation`, or `def.a11y.relation()` already supports it;
- define a separately governed Runtime/A11y relationship-projection service as owner of the scoped lease table, atomic re-keying, target epochs, diagnostics, and cleanup, while keeping Anatomy limited to structured declaration, domain scope, and readiness signals under `C-ANATOMY-0001`;
- define the adapter capability for ID reservation, pre-commit projection, and fail-closed zero/multiple matching; and
- revise Tabs prototype/test mappings plus the reusable Disclosure/Collapsible/Accordion prerequisite mapping without changing unrelated stable guarantees.

All new or revised entities remain governed by their declared lifecycle status. This record cannot turn a draft decision into an active guarantee.

## Executable evidence

- Schema/type tests reject incomplete or host-specific declarations and prove protocol match keys are not host IDs.
- Runtime/module tests cover independent same-family domains, same-root multi-family isolation, zero/one/multiple matches, arbitrary string keys including `__proto__` and `constructor`, target replacement, stale epochs, detach/rematerialization, and terminal disposal. The multi-family case uses identical root identity, target role, and protocol key and proves the family-qualified resolver never cross-matches or reports false duplicate ambiguity.
- Re-key tests change a mounted target from value A to B and prove one atomic removal/insertion, no reentrant dispatch, old-source IDREF removal, new-source restoration, and duplicate ambiguity preservation.
- Pre-commit tests prove a rematerialized target receives its reserved ID and reciprocal relationships before reveal; a mounted callback-only implementation must fail this test.
- Web adapter tests prove unique stable ID ownership, missing/duplicate fail-closed behavior, reservation reuse across L1 detach, and release on terminal disposal. Additive-IDREF cases begin with host-authored and independently owned tokens, then prove detach, ambiguity, re-key, replacement, and terminal cleanup remove only the Proto-generated lease token and remove the host attribute only when it is truly empty.
- Tabs migration tests cover reciprocal Trigger/Content relationships for lazy and `keepMounted` Content without adding presence or IDs to `TABS_CONTEXT`.
- Browser evidence exercises the Web Component, React, Vue 3, and active Vue 2 adapters separately. Disclosure/Collapsible/Accordion remain outside this prerequisite implementation slice except as future consumers of the admitted reusable contract.

## Status

This remains a non-normative design record. Implementation may proceed only after the structured declaration, ownership, pre-commit seam, adapter capability, and test mappings are reconciled in `spec/**` under the #549/#388 authority. Until then, no public same-domain relationship API exists, existing string-based relation behavior remains current implementation evidence, and this proposal must not be presented as a completed or stable guarantee.
