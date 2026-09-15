---
name: pui-verify
description: Independently attempt to falsify one Proto UI autonomous-maintenance finding in a fresh non-mutating context. Use after pui-observe produced a candidate finding and route the result directly to remediation or closure when authority is clear.
---

# Verify one finding

1. Require a fresh context and the raw Observer artifacts, baseline, and candidate finding.
2. Read `AGENTS.md`, the autonomous-maintenance procedure, Verifier prompt, mission, and governing sources completely.
3. Reconstruct the evidence independently. Do not inherit the Observer's desired classification.
4. Attempt falsification, identify the owning layer, correct scope, and distinguish authority drift from implementation or projection drift.
5. Keep verification non-mutating so its classification remains independent.
6. Return the protocol classification, corrected finding, evidence limits, residual uncertainty, and the next automatic route.

Route a rejected finding to `pui-record`. Route a confirmed implementation, test, or projection drift whose expected result is already governed to `pui-remediate`. Produce one concentrated `unresolved-product-direction` packet only when available authority leaves materially different semantic or compatibility outcomes open.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep evidence references exact.
