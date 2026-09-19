# Project V2 operating design

This document specifies the planned organization Project as an operational view across Proto UI repositories. It does not assert that the Project is deployed. The dated GitHub forensics record owns current observations and access limits.

`spec/**` remains the authority for product semantics. Issues remain the source for bounded work. Pull requests remain the source for proposed integration. The Project only projects operational state.

## Field schema

Use built-in fields where GitHub already owns the fact. Do not copy repository, milestone, assignee, review state, or pull-request state into free text.

| Field | Type | Meaning | Writer |
| --- | --- | --- | --- |
| Status | single select | Current operational position | deterministic automation or authorized operator |
| Readiness | single select | Whether the bounded work can advance | validated readiness projection or independent reviewer |
| Current decision | single select | The unresolved decision class, normally `none` | validated projection or attended decision recorder |
| Work type | single select | Stable work taxonomy | deterministic label projection |
| Area | single select | Owning repository surface | deterministic label projection or authorized operator |
| Effort | single select | Reviewable size and uncertainty | contributor or Agent proposal with evidence |
| Priority | single select | Relative queue order | governed queue policy or authorized operator |
| Required capability | single select | Minimum autonomous Agent comprehension band | deterministic task classification or reviewer |
| Mutation ceiling | single select | Largest permitted action class | active capability policy |
| Evidence state | single select | Progress of required executable and review evidence | deterministic projection or reviewer |
| Claim owner | text | Stable contributor or Agent subject identifier | authorized claim transition |
| Claim expires | date | End of the current lease | authorized claim transition |
| Risk | single select | Operational risk used by routing and review | deterministic risk rules or reviewer |
| Iteration | iteration | Planning window | governed queue policy or authorized operator |

Field options are governed catalogs. Renaming or adding an option is a policy change, not an ad hoc board edit. Work type, area, and effort mirror canonical labels; automation must map one canonical label to one field value and report duplicates instead of guessing.

## State machines

`Status` answers where the item is. `Readiness`, `Current decision`, and `Evidence state` answer different questions and must not be inferred from one another.

Allowed `Status` transitions:

```text
Intake -> Shaping -> Ready -> Claimed -> In progress -> Review -> Accepted -> Done
   |         |         |        |             |          |
   +-------> Blocked <-+--------+-------------+----------+
```

- New items enter `Intake` deterministically.
- Validated readiness moves an item from `Shaping` to `Ready` when scope, exclusions, authority, acceptance, validation, and any real decision boundary are explicit.
- A current-user or standing-authorized claim moves one `Ready` item to `Claimed` and records owner and expiry atomically.
- Work enters `In progress` while the claim, scope, repository revision, capability envelope, and live task state still match.
- Complete implementation and evidence move the exact revision to `Review`; ready-for-review and recheck metadata may advance automatically under their standing scopes.
- Independent acceptance permits `Accepted`. Exact-head integration or verified closure moves the item to `Done`.
- Any state may move to `Blocked` when a recorded prerequisite becomes false. Revalidation returns it to the last justified state without skipping evidence.

`Readiness` has four values: `Unassessed`, `Needs decision`, `Ready`, and `Blocked`. A validated projection may set `Ready` when the Issue has a bounded outcome, applicable authority, explicit exclusions, acceptance criteria, validation commands, no conflicting ownership, and no unresolved product direction. No single label, assessment score, check, or claim proves readiness by itself.

`Current decision` has three values: `none`, `unresolved-product-direction`, and `privileged-or-irreversible-operation`. A privileged delivery decision does not prevent otherwise ready implementation and evidence work from advancing.

`Evidence state` has five values: `Not planned`, `Planned`, `Running`, `Complete`, and `Failed`. Machine checks may update this field from exact workflow evidence. A check result alone cannot accept a change or choose product direction; the readiness projection evaluates the complete bounded record.

## Claims and concurrency

A claim is a lease, not permanent ownership. The claim transition binds the item identity and update time, contributor identity, governed scope, allowed operations, repository revision, capability envelope, current or standing authorization, live permission, and expiry.

One service-side operation updates `Status`, `Claim owner`, and `Claim expires` with an idempotency key and compare-and-set or equivalent atomic lease. Before writing, it re-reads assignees, comments, linked pull requests, and current Project fields. Without that concurrency boundary, an Agent returns a claim proposal instead of racing another writer.

Expiry automation may release the exact expired lease after revalidating that no matching work remains active, preserving its prior owner and evidence in the ledger. It never deletes work or silently transfers a live claim; ambiguous ownership becomes `Needs decision` with one focused packet.

## Synchronization rules

- Issue close sets `Done` when linked pull requests, reviews, and required delivery evidence contain no contradiction; otherwise it records the exact unresolved fact.
- Pull-request open, review, recheck, ready-for-review, merge, and close events update only fields they directly prove.
- Milestone and iteration remain separate. A milestone expresses an outcome; an iteration expresses a planning window.
- Label synchronization is one-way from the canonical label taxonomy into Project classification fields. Project workflow state must not create status labels.
- Every automation writes the source event identity and an idempotency key to its external ledger. Replaying the same event produces no additional mutation.
- Policy-resolved conflicts reconcile deterministically. A conflict that exposes genuinely unresolved product direction or an ambiguous privileged operation creates one decision packet and leaves the last proven state unchanged.

## Decision boundaries

The default is `Current decision: none`. Ready governed work proceeds through claim, implementation, validation, independent review, recheck, ready-for-review, and exact-head integration when an active standing scope, live permission, trusted CI, provenance, idempotency, and repository rules all agree. Project state displays that evidence but never supplies authority by itself.

Only two decision classes interrupt the automatic path:

- `unresolved-product-direction`: applicable authority does not decide a material semantic identity, ownership, public guarantee, lifecycle, or compatibility choice;
- `privileged-or-irreversible-operation`: publication, release, access, secrets, rulesets, security disclosure, a DCO/provenance exception, or another operation that cannot be safely bounded and recovered.

Normal finding disposition, commit grouping, claims, labels and ordinary metadata, review disposition, recheck, ready-for-review, and merge are workflow transitions rather than default attended decisions.

## Rollout

1. After one privileged-operation authorization provisions the least-privilege Project credential and installation, capture a dated Project V2 baseline and register the exact fields, views, and automation identity.
2. Create the organization Project, add the governed field schema and saved views, and verify that no field duplicates product authority.
3. Import a bounded live set and compare every projected value with its canonical Issue, pull request, review, check, or policy source.
4. Exercise intake, readiness, claims, evidence, review/recheck, ready-for-review, and completion transitions against replay, stale-input, permission-loss, and concurrency fixtures.
5. Enable deterministic projections and reversible metadata writes under exact standing scopes, atomic leases, durable receipts, and a disable path.
6. Connect accepted exact heads to the existing review and integration primitives; the Project projects their receipts instead of manufacturing approval.
7. Audit drift, duplicate suppression, stale-claim recovery, and false transitions continuously while expanding independently evidenced action classes.

Rollback disables the writer, preserves its ledger, and restores only values whose last writer and prior value are proven. Unknown provenance enters an attended repair as a provenance exception.

## Acceptance

The Project is operational when access is verified, fields match this design, views expose ready work and the two decision queues, event replay is idempotent, claims use atomic leases, ordinary metadata transitions reconcile automatically, exact-head review and integration receipts project correctly, and the public contribution guide matches deployed behavior. Issues, pull requests, reviews, checks, and active policy remain the canonical coordination sources throughout rollout.
