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

The registry always requires `verification-report` and `maintenance-outcome`. It additionally requires `decision-packet` when the handoff declares `unresolved-product-direction`; it does not require a fabricated decision for a governed remediation. The remediation route still requires its separate semantic and mutation authorization artifacts, and an autonomous handoff with an unresolved decision remains terminal.

Follow the [shared handoff and exact-action trust contract](../../../internal/agent-operations/contributor-agents.md#handoff-and-exact-action-trust) and return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Communicate with the user in the user's current language. Keep evidence references exact.
