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

Follow the [shared handoff and exact-action trust contract](../../../internal/agent-operations/contributor-agents.md#handoff-and-exact-action-trust) and return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Communicate with the user in the user's current language. Keep evidence references exact.
