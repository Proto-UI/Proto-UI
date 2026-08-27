# Project V2 operating design

This document specifies the planned organization Project as an operational view across Proto UI repositories. It does not assert that the Project is deployed. The dated GitHub forensics record owns current observations and access limits.

`spec/**` remains the authority for product semantics. Issues remain the source for bounded work. Pull requests remain the source for proposed integration. The Project only projects operational state.

## Field schema

Use built-in fields where GitHub already owns the fact. Do not copy repository, milestone, assignee, review state, or pull-request state into free text.

| Field | Type | Meaning | Writer |
| --- | --- | --- | --- |
| Status | single select | Current operational position | deterministic automation or maintainer |
| Readiness | single select | Whether implementation may start | maintainer |
| Current gate | single select | The next attended decision, if any | maintainer or validated projection |
| Work type | single select | Stable work taxonomy | deterministic label projection |
| Area | single select | Owning repository surface | deterministic label projection or maintainer |
| Effort | single select | Reviewable size and uncertainty | contributor proposal, maintainer confirmation |
| Priority | single select | Relative queue order | maintainer |
| Required capability | single select | Minimum autonomous Agent comprehension band | maintainer |
| Mutation ceiling | single select | Largest permitted action class | maintainer |
| Evidence state | single select | Progress of required executable and review evidence | deterministic projection or reviewer |
| Claim owner | text | Stable contributor or Agent subject identifier | authorized claim transition |
| Claim expires | date | End of the current lease | authorized claim transition |
| Risk | single select | Operational risk used by routing and review | maintainer |
| Iteration | iteration | Planning window | maintainer |

Field options are governed catalogs. Renaming or adding an option is a policy change, not an ad hoc board edit. Work type, area, and effort mirror canonical labels; automation must map one canonical label to one field value and report duplicates instead of guessing.

## State machines

`Status` answers where the item is. `Readiness`, `Current gate`, and `Evidence state` answer different questions and must not be inferred from one another.

Allowed `Status` transitions:

```text
Intake -> Shaping -> Ready -> Claimed -> In progress -> Review -> Accepted -> Done
   |         |         |        |             |          |
   +-------> Blocked <-+--------+-------------+----------+
```

- New items may enter `Intake` deterministically.
- A maintainer moves an item from `Shaping` to `Ready` after scope, exclusions, authority, implementation authorization, acceptance, and validation are explicit.
- An authorized claim moves one `Ready` item to `Claimed` and records owner and expiry atomically.
- Work may enter `In progress` only while the claim, scope, repository revision, authorization, and live task state still match.
- A contributor may propose `Review`; the maintainer-owned ready-for-review gate remains separate.
- Independent acceptance permits `Accepted`. Merge or closure may permit `Done`.
- Any state may move to `Blocked` when its recorded prerequisite becomes false. Unblocking returns to the last justified state, never to a more advanced state.

`Readiness` has four values: `Unassessed`, `Needs decision`, `Ready`, and `Blocked`. Only a maintainer decision may set `Ready`. A label, assessment score, passing check, claim, or Project automation cannot do so.

`Evidence state` has five values: `Not planned`, `Planned`, `Running`, `Complete`, and `Failed`. Machine checks may update this field from exact workflow evidence. They cannot update acceptance or semantic readiness.

## Claims and concurrency

A claim is a lease, not permanent ownership. The claim transition must bind the item identity and update time, contributor identity, approved scope, allowed operations, repository revision, capability envelope, live permission, human authorization, and expiry.

One service-side operation must update `Status`, `Claim owner`, and `Claim expires` with an idempotency key. Before writing, it re-reads assignees, comments, linked pull requests, and current Project fields. If global compare-and-set or an equivalent idempotent service is unavailable, Agents may prepare a claim proposal but must not post or update Project state automatically.

Expiry automation may flag a stale claim. It must not delete a human's work, reassign the item, or give the item to another contributor without an attended decision.

## Synchronization rules

- Issue close may propose `Done`; it does not override an open pull request, unresolved review, or missing release evidence.
- Pull-request open, review, merge, and close events update only fields they directly prove.
- Milestone and iteration remain separate. A milestone expresses an outcome; an iteration expresses a planning window.
- Label synchronization is one-way from the canonical label taxonomy into Project classification fields. Project workflow state must not create status labels.
- Every automation writes the source event identity and an idempotency key to its external ledger. Replaying the same event produces no additional mutation.
- Conflicting facts stop automation and create a read-only drift report. Automation never chooses which source should win when policy does not already decide it.

## Human gates

The default human-gate catalog lives in `internal/agent-operations/capability-policy.yaml`. Project fields may display the next gate, but cannot satisfy it. Semantic admission, ownership, compatibility tradeoffs, contributor rights, security handling, publication, release, access, secrets, and repository rule changes stay attended. Approval or merge may proceed unattended only through an exact active standing authorization whose live evidence and repository rules already resolve that bounded action; Project state alone never supplies that authorization.

## Rollout

1. Obtain an access token that can read Project V2 and capture a dated baseline of existing Projects, fields, views, and automation.
2. Create the organization Project with no write automation.
3. Add the field schema and saved views. Verify that fields do not duplicate semantic authority.
4. Import a bounded set of live items and compare every projected value with its source.
5. Enable deterministic intake and evidence projections in shadow mode. Preserve proposed writes as artifacts.
6. Review idempotency, concurrency, rollback, stale-claim, and permission evidence.
7. Enable one reversible write class after an explicit maintainer decision. Keep semantic and integration transitions manual unless a separately reviewed standing authorization fixes the exact action, evidence, permission, idempotency, and rollback boundary.
8. Audit drift and false transitions before adding another write class.

Rollback disables the writer, preserves its ledger, and restores only values whose last writer and prior value are proven. Unknown provenance requires manual repair.

## Acceptance

The Project is operational only when read access is verified, field options match this design, saved views expose each decision queue, event replay is idempotent, stale claims cannot be reassigned silently, conflicting facts fail closed, and the public contribution guide matches the deployed behavior. Until then, Issues and maintainer checkpoints remain the live coordination source.
