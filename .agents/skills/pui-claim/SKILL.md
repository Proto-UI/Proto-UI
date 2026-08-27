---
name: pui-claim
description: Post one already selected Proto UI work-item claim as a reversible GitHub metadata mutation. Use only after pui-select produced a current proposal and the exact claim has authorization, live permission, current readiness, and an idempotent write boundary. Do not select work, decide readiness, release claims, or widen the approved wording.
---

# Post one approved claim

1. Require a current `pui-orient` envelope. In autonomous mode the claim must be within the fresh C2-or-higher ceiling; in human-assisted mode the assessment remains advisory.
2. Require the raw `pui-select` proposal, explicit or standing authorization for its exact claim text and scope, live GitHub permission, and an idempotency key bound to the issue update time, repository, requested action, and contributor.
3. Re-read the live issue, assignee, recent comments, linked pull requests, and Project claim state immediately before posting.
4. Stop without writing if readiness, ownership, scope, evidence, permission, authorization, or the idempotency state has changed. Record `pui-select` as the proposed next leaf without loading it. Do not repair or reinterpret the proposal inside this transition.
5. Post exactly one claim containing the approved scope, planned evidence, capability band, and expiry.
6. Return a mutation receipt with the issue identity, claim URL or identifier, timestamp, observed pre-state, resulting state, and the bounded subject for `pui-trace`.

Do not change readiness, semantic approval, required capability, labels, milestones, or assignments. Do not post a second claim or release an existing claim.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep GitHub identifiers canonical.
