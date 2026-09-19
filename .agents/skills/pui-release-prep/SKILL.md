---
name: pui-release-prep
description: Prepare a reviewed Proto UI global release candidate as repository state after current project authority has chosen the exact version and stage. Use for draft Version identity, exact package metadata, notes, bill of materials, rehearsal, and publish dry-run. Publication remains a distinct privileged operation.
---

# Prepare a release candidate

1. Read `AGENTS.md` and all applicable files under `internal/governance/**` and `internal/releases/**`.
2. Use the recorded project authority for the exact global version, stage, package set, and scope. If current authority leaves one of those product choices unresolved, return that single product-direction decision while continuing all unaffected preparation evidence.
3. Start from the governed base and inspect current registry and release evidence without mutating them.
4. Prepare the draft Version entity, exact manifests and lockfile, reviewed notes, bill of materials, and required snapshot inputs as one coherent state.
5. Keep public availability and active lifecycle pointed at the last verified release.
6. Run release scan, rehearsal, asset checks, publish dry-run, Agent projection checks, types, docs, and consumer evidence required by policy.
7. Return candidate SHA, exact evidence, failures, residual risks, and the one privileged publication decision still required.

Keep package publication, tag creation or movement, GitHub Release creation, Version activation, and partial external-publication recovery in their purpose-bound privileged operation. This preparation leaf advances every reversible repository step and hands the exact candidate evidence to that operation.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep release identifiers exact.
