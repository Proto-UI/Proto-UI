---
name: pui-deps
description: Assess and route one bounded Proto UI dependency drift, advisory, or update question. Use to trace manifest and lockfile identity, consumer impact, compatibility evidence, provenance, update risk, and the exact next update or no-action transition. This leaf remains read-only.
---

# Assess dependency drift

1. Require the registered `repository-snapshot` and `bounded-question` artifacts identifying the bounded dependency, manifest set, advisory source, and repository revision. Preserve any existing current capability envelope, authority map, and implementation authorization by reference; the read-only assessment does not produce them.
2. Read package, lockfile, release, and compatibility governance for the affected graph.
3. Inspect declared ranges, resolved identities, provenance, direct and reverse consumers, public surfaces, advisory facts, and existing update automation.
4. Separate known vulnerability or incompatibility evidence from version age and update availability.
5. Define the smallest coherent update boundary, required regression evidence, rollback boundary, and unknowns. Ordinary governed manifest and lockfile updates may proceed to `pui-dependency-update` only under the handoff conditions below; owner-specific semantic repairs belong to their implementation or regression leaf. Record an attended decision only for unresolved compatibility direction, security disclosure, publication, or provenance exception.
6. Return exact facts and one eligible update, owner-specific regression, or validation transition, or a terminal dependency report when already current or no next transition is eligible.

Remain read-only. Do not install packages, rewrite a lockfile, dismiss an advisory, alter automation, or infer compatibility from a version number.

## Explicit handoff

Return one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`, with `fromId` set to `pui-deps` and the registered `dependency-report` artifact.

- Select `nextSkillId: pui-dependency-update` only when a current `pui-orient` `capability-envelope`, an applicable `pui-trace` `authority-map`, and an applicable `implementation-authorization` already exist for the assessed update boundary. Carry all three artifacts by reference alongside `dependency-report`, preserving their existing references and any digests. The dependency report is evidence, not authority or authorization; do not synthesize these prerequisites from update availability or this read-only assessment.
- If any prerequisite is unavailable, return `nextSkillId: null` with the dependency report and name the missing artifact in `notes`. A missing routing artifact alone is not an attended product decision and does not create a `humanGates` entry.
- For every non-null route, carry all artifacts required by that next leaf and validate the handoff before it is loaded. Preserve the recorded execution mode, genuine attended decisions, and the resolver's autonomous capability ceiling; the presence of artifacts does not bypass those gates.

Communicate with the user in the user's current language. Keep package identities canonical.
