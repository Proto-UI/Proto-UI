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
7. Record the explicit integration decision after it occurs. Keep commit grouping, merge, publication, and release separately gated.
8. Return closure evidence, the exact changed maintenance-state paths, and the next eligible transition.

Do not invent metrics, close an inadequately reviewed run, or treat technical completion as integration authorization.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep run identifiers exact.
