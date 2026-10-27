---
name: pui-unclaim
description: Release one current Proto UI work-item claim when it expired, became invalid, or the contributor stopped. Use only for the contributor's own recorded claim and only when the exact reversible GitHub mutation is authorized. Do not select replacement work, change readiness, or release another contributor's claim.
---

# Release one claim

1. Require a current `pui-orient` envelope. In autonomous mode the release must be within the fresh C2-or-higher ceiling; in human-assisted mode the assessment remains advisory.
2. Read the original claim receipt, current issue, recent comments, linked work, assignee, and Project claim state when available.
3. Require one explicit release reason: expiry, changed boundary, invalidated task state, blocking dependency, stopped work, or completed handoff.
4. Revalidate live GitHub permission, current authorization, claim ownership, target version, and the idempotency key for the requested release action.
5. Post exactly one request-bound release notice and clear only claim metadata that the current contributor owns and is authorized to change.
6. After a timeout or other unknown write outcome, reconcile the exact claim and release marker once. Attribute success only when the intended owned metadata is released; otherwise return the reconciled terminal result and never retry blindly.
7. Return a mutation receipt containing the claim identity, release reason, observed pre-state, resulting state, timestamp, and any bounded handoff.

An ownership, permission, authorization, or live-state mismatch returns an exact no-action receipt for recollection. The release boundary preserves readiness, semantics, labels, milestone, every other contributor's assignment, and implementation scope.

Publish the release notice through `pnpm agent:publish -- comment --repository github.com:OWNER/REPO --number ISSUE_NUMBER --body-file <authorized-release-notice.md> --body-digest <authorized-release-notice-sha256> --mode human-assisted --mode-source current-user --authorization explicit-current-user` when this is the independently established authorized mode; supported metadata changes use separate exact-target `agent:collaborate` actions. Preserve human original text and all ambiguous/failed results and anomalies.

Follow the [shared handoff and exact-action trust contract](../../../internal/agent-operations/contributor-agents.md#handoff-and-exact-action-trust) and return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Communicate with the user in the user's current language. Keep GitHub identifiers canonical.
