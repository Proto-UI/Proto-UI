---
name: pui-deps
description: Assess and route one bounded Proto UI dependency drift, advisory, or update question. Use to trace manifest and lockfile identity, consumer impact, compatibility evidence, provenance, update risk, and the exact next update or no-action transition. This leaf remains read-only.
---

# Assess dependency drift

1. Require a current capability envelope and a bounded dependency, manifest set, advisory source, and repository revision.
2. Read package, lockfile, release, and compatibility governance for the affected graph.
3. Inspect declared ranges, resolved identities, provenance, direct and reverse consumers, public surfaces, advisory facts, and existing update automation.
4. Separate known vulnerability or incompatibility evidence from version age and update availability.
5. Define the smallest coherent update boundary, required regression evidence, rollback boundary, and unknowns. Ordinary governed manifest and lockfile updates proceed to `pui-dependency-update`; owner-specific semantic repairs proceed to their implementation or regression leaf. Record an attended decision only for unresolved compatibility direction, security disclosure, publication, or provenance exception.
6. Return exact facts and one explicit `pui-dependency-update`, owner-specific regression, validation, or already-current transition.

Remain read-only. Do not install packages, rewrite a lockfile, dismiss an advisory, alter automation, or infer compatibility from a version number.

Return one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`, with `fromId` set to `pui-deps`, the registered dependency report artifact, and at most one `nextSkillId`.

Communicate with the user in the user's current language. Keep package identities canonical.
