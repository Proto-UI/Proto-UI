---
name: pui-validate
description: Select, run, and report proportional Proto UI validation for a completed change. Use before review, handoff, commit, or pull request updates, and after resolving validation failures. Cover focused evidence first, then affected graph, types, docs, packaging, consumers, release, or repository checks according to risk.
---

# Validate a change

1. Read `AGENTS.md`, the actual diff, the `pui-trace` map, and any approved validation boundary.
2. Check worktree and generated-file discipline before running tests.
3. Run focused evidence first. Confirm it exercises the intended failure and owning layer.
4. Expand through affected entity graph, Runtime or Adapter integration, types, public docs, package surfaces, consumer smoke, and release governance as the change requires.
5. Run generators before their corresponding check mode. Never hand-edit generated output.
6. Record command, exit status, relevant output, environment, and skipped checks. Do not claim a check that did not run.
7. Separate machine evidence, manual acceptance, semantic approval, and deployment evidence.
8. Return failures to the owning skill with the smallest useful diagnosis.

Passing checks establish technical evidence, not product correctness, review approval, merge permission, or release authorization.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep commands and paths exact.
