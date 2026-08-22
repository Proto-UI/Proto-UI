---
name: pui-govern
description: Audit one bounded Proto UI collaboration-governance slice across Issues, pull requests, Discussions, labels, milestones, Project, rules, permissions, or Actions. Use to report taxonomy or state drift. Do not change metadata, policy, access, rules, or workflow state.
---

# Audit collaboration state

1. Require a current capability envelope and a bounded set of repositories, surfaces, fields, and observation time.
2. Read collaboration policy and the latest applicable dated record. Keep stable policy separate from current observation.
3. Query every in-scope surface with pagination and record API scopes, filters, truncation, and unavailable fields.
4. Assign one meaning to each surface: conversation, bounded work, operational state, search property, program outcome, integration unit, review, machine evidence, or delivery fact.
5. Detect duplicate taxonomy, stale states, conflicting owners, unprotected expectations, missing gates, and projection drift without choosing new policy.
6. Return a dated evidence matrix, gaps, uncertainty, and one explicit decision or documentation transition.

Remain read-only. Missing Project or administration scope is an observation limit, not proof that configuration is absent.

Return one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`, with `fromId` set to `pui-govern`, the registered governance report artifact, and at most one `nextSkillId`.

Communicate with the user in the user's current language. Keep GitHub names and identifiers canonical.
