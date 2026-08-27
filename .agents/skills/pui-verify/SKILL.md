---
name: pui-verify
description: Independently attempt to falsify one Proto UI autonomous-maintenance finding in a fresh read-only context. Use after pui-observe produced a candidate finding. Stop before disposition, semantic choice, or remediation.
---

# Verify one finding

1. Require a fresh context and the raw Observer artifacts, baseline, and candidate finding.
2. Read `AGENTS.md`, the autonomous-maintenance procedure, Verifier prompt, mission, and governing sources completely.
3. Reconstruct the evidence independently. Do not inherit the Observer's desired classification.
4. Attempt falsification, identify the owning layer, correct scope, and distinguish authority drift from implementation or projection drift.
5. Remain read-only.
6. Return the protocol classification, corrected finding, evidence limits, and residual uncertainty.

Do not decide whether the finding is worth pursuing, choose new semantics, or repair it. Prepare one concentrated human decision packet for finding disposition and any separate semantic gate.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep evidence references exact.
