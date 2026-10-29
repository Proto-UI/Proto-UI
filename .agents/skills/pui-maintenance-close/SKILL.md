---
name: pui-maintenance-close
description: Close one technically complete Proto UI autonomous-maintenance transition after adequate independent review and required validation. Use to synchronize the finding, remediation packet, mission, run ledger, residual-risk queue, and recorded integration decision.
---

# Close a maintenance transition

1. Require an adequate independent review, complete validation, and no blocking residual risk.
2. Require a current autonomous envelope, a fresh C2-or-higher ceiling, and explicit or standing authorization covering every finding, packet, mission, queue, and ledger path that may change.
3. Read `AGENTS.md`, the autonomous-maintenance procedure, all run artifacts, and current ledger state.
4. Run the deterministic autonomous-maintenance checks before closure.
5. Synchronize finding status, packet, mission, run IDs, baselines, classifications, completion rule, metrics, and ledger. Record unknown metrics as null.
6. Convert only bounded residual risks with an external oracle into candidate missions when that queue mutation is separately authorized and lease-safe.
7. Record the exact integration receipt after it occurs. Route a clean exact-head PR to the ordinary review and integration skills under current or standing authorization.
8. Return closure evidence, the exact changed maintenance-state paths, and the next eligible transition.

Do not invent metrics or close an inadequately reviewed run. Technical completion feeds the exact-head integration preflight; it does not bypass live permission, CI, independent review, or repository rules.

Follow the [shared handoff and exact-action trust contract](../../../internal/agent-operations/contributor-agents.md#handoff-and-exact-action-trust) and return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Communicate with the user in the user's current language. Keep run identifiers exact.
