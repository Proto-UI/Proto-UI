---
name: pui-maintenance-review
description: Independently review one Proto UI autonomous-maintenance remediation in a fresh read-only context. Use after pui-remediate produces a packet and actual diff. Classify technical-completion eligibility without making product or integration decisions.
---

# Review maintenance remediation

1. Require a fresh context, raw finding, baseline, remediation packet, actual diff, and validation logs.
2. Read `AGENTS.md`, the autonomous-maintenance procedure, and Review Synthesizer prompt completely.
3. Reconstruct scope and authority independently.
4. Check packet fidelity, consumer coverage, exclusions, evidence truthfulness, generated projections, and residual risks.
5. Remain read-only. Attempt to falsify completion.
6. Return `adequate`, `incomplete`, or `misleading` with exact evidence.

Return technical gaps to `pui-remediate`. Route an adequate governed repair to `pui-maintenance-close`; return only a genuinely unresolved product or compatibility direction to a maintainer. Keep this context non-mutating so the verdict remains independent.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep evidence references exact.
