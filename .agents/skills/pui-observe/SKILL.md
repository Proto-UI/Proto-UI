---
name: pui-observe
description: Execute one bounded read-only Proto UI autonomous-maintenance observation mission. Use for drift hunting, external-oracle comparison, repeatability control, or a no-finding maintenance run. Stop before verification or remediation.
---

# Observe one maintenance mission

1. Read `AGENTS.md`, the autonomous-maintenance procedure, selected mission, Observer prompt, run ledger, and baseline completely.
2. Record starting SHA and worktree state.
3. Keep observation non-mutating so the evidence can feed an independent verifier without contaminating the baseline.
4. Follow only the mission's bounded oracle and completion rule.
5. Prefer one falsifiable finding over a list of suspicions. Preserve raw evidence and exact reproduction steps.
6. Record an explicit no-finding result when the oracle does not support a finding.
7. Finish with an Observer report that routes automatically to a fresh verifier when a finding exists, or to recorded closure for a supported no-finding result.

Return a copy-ready handoff for a fresh `pui-verify` context when a finding exists.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep evidence references exact.
