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

Follow the [shared handoff and exact-action trust contract](../../../internal/agent-operations/contributor-agents.md#handoff-and-exact-action-trust) and return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Communicate with the user in the user's current language. Keep evidence references exact.
