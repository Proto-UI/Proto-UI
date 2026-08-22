---
name: pui-remediate
description: Repair one independently verified Proto UI maintenance finding after human finding disposition and required semantic scope are explicitly accepted. Use for the bounded remediation and its evidence packet. Stop before independent review, integration, merge, publication, or release.
---

# Remediate one accepted finding

1. Require verified finding state, accepted disposition, explicit semantic direction, corrected scope, baseline, and current worktree state.
2. Read `AGENTS.md`, the autonomous-maintenance procedure, finding, and remediation-review template completely.
3. Create or update the remediation packet before behavioral edits.
4. Map authority, direct and indirect consumers, exclusions, evidence limits, generated projections, and residual risks.
5. Repair only the verifier-corrected scope. If another atomic development transition is required, stop and identify exactly one next leaf in the handoff instead of loading it.
6. Record exact results in the packet.
7. Stop with a handoff containing the actual diff, baseline, finding, packet, validation logs, and unresolved risks.

Do not review your own remediation or infer integration authority from passing checks.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep evidence references exact.
