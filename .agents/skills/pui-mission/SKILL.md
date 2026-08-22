---
name: pui-mission
description: Freeze one explicitly selected Proto UI autonomous-maintenance candidate into a bounded mission packet and lease. Use before observation when scope, oracle, baseline, capability, risk, budget, completion, and stop conditions have been approved. Do not observe, verify, repair, or invent a mission.
---

# Freeze one maintenance mission

1. Require a current autonomous envelope, one candidate selected by a maintainer, a fresh C2-or-higher ceiling, and explicit or standing authorization for the exact queue and mission paths.
2. Reject blocked, already leased, expired, duplicated, unbounded, or capability-ineligible candidates.
3. Freeze the exact baseline, scope, negative boundary, oracle, required evidence, required band, task class, risk, budget, fresh-context rule, completion rule, stop conditions, and human gates.
4. Acquire one expiring lease through the authorized state writer. Do not represent a local file check as a global lease.
5. Create the mission packet and synchronize only the queue fields covered by the authorization, current target version, and acquired lease.
6. Return the frozen mission, lease receipt, prior and resulting state, exact changed paths, and the eligible observation transition.

Do not infer semantic direction, finding disposition, mutation authority, integration, or publication. Stop when a global lease cannot be acquired or any frozen input remains unknown.

Return one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`, with `fromId` set to `pui-mission`, the registered mission and mutation receipt artifacts, and at most one `nextSkillId`.

Communicate with the user in the user's current language. Keep mission and lease identifiers exact.
