---
name: pui-test
description: Design or implement the smallest complete executable evidence for a governed Proto UI behavior. Use for conformance cases, regression tests, cross-layer verification, test-entity mappings, failure-path coverage, or validation-plan design. Do not use tests to decide unsettled semantics.
---

# Build executable evidence

Apply the [bounded development and acceptance policy](../../../internal/governance/release-0.3-plan.md). Design tests for observable consumer behavior, boundaries and transitions, not source spelling or current recipe wiring. Name the original criteria each executed result completes; collection, mocks and a partial suite do not complete unexecuted acceptance. Passing a bounded criterion should produce an actionable checkbox update, not another generic debt summary.

For input attribution, asynchronous ownership, CSS projection or uncertain test coverage, read `internal/agent-operations/testing-method.md`. Apply the techniques needed to distinguish the governed failure, not a universal list of Scroll cases.

1. Require a `pui-trace` map and governed expected behavior.
2. Identify the semantic owner, observable boundary, affected hosts, direct and indirect consumers, negative boundary, and failure modes.
3. Choose the lowest layer that can prove the rule, then add integration or consumer evidence only where translation or packaging could fail.
4. Make the test fail for the intended reason before implementing a repair when practical.
5. Keep `T-*` cases and implementation paths honest. Planned, skipped, inspected, or unreachable evidence is not passing evidence.
6. Cover resource replacement, cleanup, synchronization, omission, and degraded capability when the governed rule includes them.
7. Return exact commands, results, untested surfaces, and why the evidence is sufficient.

Stop if expected behavior, owner, or compatibility is unresolved. Record `pui-brainstorm` as the proposed next leaf without loading it.

Follow the [shared handoff and exact-action trust contract](../../../internal/agent-operations/contributor-agents.md#handoff-and-exact-action-trust) and return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Communicate with the user in the user's current language. Keep test and entity identifiers canonical.
