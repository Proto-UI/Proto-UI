---
name: pui-release-audit
description: Audit an already completed protected Proto UI publication and reconcile immutable external facts with Version entities, release records, and public projections. Use after publication for registry, tag, GitHub Release, asset, checksum, workflow-head, and deployment evidence. Never republish or replace immutable evidence.
---

# Audit publication evidence

1. Read `AGENTS.md`, release governance, the approved candidate state, publication workflow logs, and current external facts.
2. Require the published version and immutable publication identity. Work from a fresh branch based on current main when repository changes are authorized.
3. Verify registry version, channel, integrity, package set, workflow head, tag target, Release type, assets, snapshot digest, and deployment status.
4. Separate confirmed external facts from missing, mutable, or conflicting evidence.
5. Update the Version entity, dated evidence record, and public projections only to match verified immutable facts.
6. Run release-version, asset, Agent projection, type, and docs checks required by governance.
7. Return a reconciliation report and any recovery decision packet.

Do not regenerate an immutable snapshot to match a release, change the version, republish, infer that all draft entities became active, or perform partial-recovery actions without explicit approval.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep external identifiers and digests exact.
