---
name: pui-review
description: Independently review a Proto UI change against current authority, approved scope, executable evidence, projections, provenance, and integration gates. Use for pull-request review, acceptance review, pre-merge audit, or fresh-context verification. Do not use to approve one's own work or to replace required human decisions.
---

# Review independently

1. Use a fresh context when independence is required. Read `AGENTS.md`, raw task artifacts, base and head SHAs, actual diff, authority map, decision packet, and validation logs.
2. Reconstruct the governing lifecycle and scope without relying on the implementer's conclusion.
3. Check source-of-truth alignment, negative boundaries, direct and indirect consumers, compatibility, generated files, provenance, DCO, and exact evidence.
4. Attempt to falsify claimed completion. Distinguish semantic acceptance, technical evidence, review state, and deployment state.
5. Classify findings by impact and give exact paths and anchors.
6. Return adequate, incomplete, or misleading evidence. Route semantic or integration choices to the appropriate human gate.

Do not submit an approval, merge, change GitHub state, or fix the change unless the user separately authorizes that action. Never issue the independent verdict for work produced in the same context.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep review references exact.
