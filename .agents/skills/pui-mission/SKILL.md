---
name: pui-mission
description: Freeze one eligible Proto UI autonomous-maintenance candidate into a bounded mission packet and lease. Use before observation when a current request or governed queue supplies scope, oracle, baseline, capability, risk, budget, completion, and stop conditions. Do not observe, verify, repair, or invent a mission.
---

# Freeze one maintenance mission

1. Require a current autonomous envelope, one eligible candidate selected by the current bounded request or governed queue, a fresh C2-or-higher ceiling, and explicit or standing authorization for the exact queue and mission paths.
2. Reject blocked, already leased, expired, duplicated, unbounded, or capability-ineligible candidates.
3. Freeze the exact baseline, scope, negative boundary, oracle, required evidence, required band, task class, risk, budget, fresh-context rule, completion rule, stop conditions, and any genuinely present attended decision class.
4. Acquire one expiring lease through the authorized state writer. A single-runner queue may use its governed local mutex and exact-item lease; overlapping runners require a globally coordinating lease before they compete for the same item.
5. Create the mission packet and synchronize only the queue fields covered by the authorization, current target version, and acquired lease.
6. Return the frozen mission, lease receipt, prior and resulting state, exact changed paths, and the eligible observation transition.

Use existing authority to resolve finding disposition and governed remediation scope. Pause when product direction is genuinely unresolved, when a privileged or irreversible operation is next, when overlapping runners lack a coordinating lease, or when a required frozen input cannot be established.

Return one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`, with `fromId` set to `pui-mission`, the registered mission and mutation receipt artifacts, and at most one `nextSkillId`.

Communicate with the user in the user's current language. Keep mission and lease identifiers exact.
