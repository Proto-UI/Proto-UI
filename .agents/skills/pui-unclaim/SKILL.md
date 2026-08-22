---
name: pui-unclaim
description: Release one current Proto UI work-item claim when it expired, became invalid, or the contributor stopped. Use only for the contributor's own recorded claim and only when the exact reversible GitHub mutation is authorized. Do not select replacement work, change readiness, or release another contributor's claim.
---

# Release one claim

1. Require a current `pui-orient` envelope. In autonomous mode the release must be within the fresh C2-or-higher ceiling; in human-assisted mode the assessment remains advisory.
2. Read the original claim receipt, current issue, recent comments, linked work, assignee, and Project claim state when available.
3. Require one explicit release reason: expiry, changed boundary, invalidated task state, blocking dependency, stopped work, or completed handoff.
4. Revalidate live GitHub permission, current authorization, claim ownership, target version, and the idempotency key for the requested release action.
5. Post exactly one release notice and clear only claim metadata that the current contributor owns and is authorized to change.
6. Return a mutation receipt containing the claim identity, release reason, observed pre-state, resulting state, timestamp, and any bounded handoff.

Stop without writing when ownership, permission, authorization, or live state is uncertain. Do not change readiness, semantics, labels, milestone, another contributor's assignment, or implementation scope.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep GitHub identifiers canonical.
