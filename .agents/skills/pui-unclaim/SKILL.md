---
name: pui-unclaim
description: Release one current Proto UI work-item claim when it expired, became invalid, or the contributor stopped. Use only for the contributor's own recorded claim and only when the exact reversible GitHub mutation is authorized. Do not select replacement work, change readiness, or release another contributor's claim.
---

# Release one claim

## Owner-authorized dot exception

The owner-authorized dot exemption in `internal/agent-operations/contributor-agents.md` takes precedence over this leaf's ModelTrace-specific sampling, record/context and disclosure requirements. When acting as dot, do not sample or invent a ModelTrace record: visibly identify `Agent: dot` and the exact not-measured exemption declaration at every write. Use the supported publisher's explicit dot branch or the guide's real connected-service path; never fake a measured artifact, a successful validator, or live `gh` responses. The exemption grants no action permission, model authentication, independent approval or repository-rule bypass. All non-ModelTrace inputs and existing authorization, exact-head/tree, DCO, CI, independent-review and readback requirements remain. Other Agents follow the measured path below unchanged.

1. Require a current `pui-orient` envelope. In autonomous mode the release must be within the fresh C2-or-higher ceiling; in human-assisted mode the assessment remains advisory. Require the active context's current content-bound `modeltrace-record` in both modes. Validate it against independent context and include its generated public receipt in the authorized release notice. Missing, expired or changed-scope records route back through the entrypoint for remeasurement, never declared-label fallback.
2. Read the original claim receipt, current issue, recent comments, linked work, assignee, and Project claim state when available.
3. Require one explicit release reason: expiry, changed boundary, invalidated task state, blocking dependency, stopped work, or completed handoff.
4. Revalidate live GitHub permission, current authorization, claim ownership, target version, and the idempotency key for the requested release action.
5. Post exactly one request-bound release notice and clear only claim metadata that the current contributor owns and is authorized to change.
6. After a timeout or other unknown write outcome, reconcile the exact claim and release marker once. Attribute success only when the intended owned metadata is released; otherwise return the reconciled terminal result and never retry blindly.
7. Return a mutation receipt containing the claim identity, release reason, observed pre-state, resulting state, timestamp, and any bounded handoff.

An ownership, permission, authorization, or live-state mismatch returns an exact no-action receipt for recollection. The release boundary preserves readiness, semantics, labels, milestone, every other contributor's assignment, and implementation scope.

Publish the release notice through `agent:publish -- comment` with `--record`, `--context`, independently established `--mode`/`--mode-source`, and exact `--authorization`; supported metadata changes use separate record-aware exact-target `agent:collaborate` actions. Carry the private record's exact reference/digest in the handoff, not samples or private context. ModelTrace is unsigned closed-set attribution, not authentication or authority. Raw `gh`/API use is no policy exemption; preserve human original text and all ambiguous/failed results and anomalies.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep GitHub identifiers canonical.
