---
name: pui-record
description: Record one authorized non-remediation terminal outcome in Proto UI's autonomous-maintenance state. Use after a supported no-finding result, an independently rejected finding, or a blocked mission whose terminal evidence is complete.
---

# Record a maintenance outcome

1. Require a current autonomous envelope, a fresh C2-or-higher ceiling, and explicit or standing authorization for every maintenance-state path.
2. Accept a supported no-finding result, a fresh independent rejection, or a blocked result whose missing oracle and completion rule are recorded.
3. Read the maintenance procedure, mission, raw report, finding when present, queue, and run ledger completely.
4. Run deterministic maintenance checks before writing.
5. Synchronize only the authorized terminal classification, evidence references, completion rule, mission state, queue state, and run ledger fields after rechecking the target version and lease. Record unknown metrics as null.
6. Return a receipt containing the prior state, resulting state, exact changed paths, evidence, residual risk, and next eligible transition.

Do not require a remediation review or maintainer disposition for a supported non-remediation outcome. Do not use this transition to avoid review when a finding was confirmed or a repair occurred. Create a bounded follow-up mission when its oracle, lease, mutation scope, and current authorization are all available.

Return one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`, with `fromId` set to `pui-record`, the registered receipt artifact, and at most one `nextSkillId`.

Communicate with the user in the user's current language. Keep run and finding identifiers exact.
