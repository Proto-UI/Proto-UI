---
name: pui-deps
description: Assess one bounded Proto UI dependency drift, advisory, or update question without changing repository or registry state. Use to trace manifest and lockfile identity, consumer impact, compatibility evidence, provenance, and update risk. Do not install, update, publish, dismiss, or open automated changes.
---

# Assess dependency drift

1. Require a current capability envelope and a bounded dependency, manifest set, advisory source, and repository revision.
2. Read package, lockfile, release, and compatibility governance for the affected graph.
3. Inspect declared ranges, resolved identities, provenance, direct and reverse consumers, public surfaces, advisory facts, and existing update automation.
4. Separate known vulnerability or incompatibility evidence from version age and update availability.
5. Define the smallest coherent update boundary, required regression evidence, rollback boundary, unknowns, and human gates without performing the update.
6. Return exact facts and one explicit planning, regression, or no-action transition.

Remain read-only. Do not install packages, rewrite a lockfile, dismiss an advisory, alter automation, or infer compatibility from a version number.

Return one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`, with `fromId` set to `pui-deps`, the registered dependency report artifact, and at most one `nextSkillId`.

Communicate with the user in the user's current language. Keep package identities canonical.
