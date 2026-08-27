---
name: pui-test
description: Design or implement the smallest complete executable evidence for a governed Proto UI behavior. Use for conformance cases, regression tests, cross-layer verification, test-entity mappings, failure-path coverage, or validation-plan design. Do not use tests to decide unsettled semantics.
---

# Build executable evidence

1. Require a `pui-trace` map and governed expected behavior.
2. Identify the semantic owner, observable boundary, affected hosts, direct and indirect consumers, negative boundary, and failure modes.
3. Choose the lowest layer that can prove the rule, then add integration or consumer evidence only where translation or packaging could fail.
4. Make the test fail for the intended reason before implementing a repair when practical.
5. Keep `T-*` cases and implementation paths honest. Planned, skipped, inspected, or unreachable evidence is not passing evidence.
6. Cover resource replacement, cleanup, synchronization, omission, and degraded capability when the governed rule includes them.
7. Return exact commands, results, untested surfaces, and why the evidence is sufficient.

Stop if expected behavior, owner, or compatibility is unresolved. Record `pui-brainstorm` as the proposed next leaf without loading it.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep test and entity identifiers canonical.
