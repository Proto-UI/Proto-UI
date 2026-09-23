---
name: pui-remediate
description: Repair one independently verified Proto UI maintenance finding when governing authority or an explicit product decision fixes the expected result. Use for the bounded remediation and its evidence packet before independent review.
---

# Remediate one accepted finding

1. Require verified finding state, corrected scope, baseline, current worktree state, and either governing authority that fixes the expected result or one explicit product-direction decision.
2. Read `AGENTS.md`, the autonomous-maintenance procedure, finding, and remediation-review template completely.
3. Create or update the remediation packet before behavioral edits.
4. Map authority, direct and indirect consumers, exclusions, evidence limits, generated projections, and residual risks.
5. Repair only the verifier-corrected scope. If another atomic development transition is required, stop and identify exactly one next leaf in the handoff instead of loading it.
6. Record exact results in the packet.
7. Hand the actual diff, baseline, finding, packet, validation logs, and unresolved risks directly to a fresh independent maintenance reviewer.

Do not review your own remediation. Passing checks plus adequate independent review establish technical completion; exact-head integration still revalidates its own live conditions.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep evidence references exact.
