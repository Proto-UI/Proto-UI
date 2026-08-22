---
name: pui-module
description: Implement or extend one approved Proto UI Module semantic slice. Use when Module ownership, facade and port boundary, dependencies, resource lifetime, Host Capability plan, Runtime registration, Adapter evidence, and validation scope are already governed. Do not use to admit a new Module or decide ownership.
---

# Implement a Module slice

1. Require `pui-orient`, `pui-trace`, and recorded approval for the complete slice.
2. Read the applicable knowledge, decision, contract, Module, Host Capability, Adapter, and test entities plus current Runtime and implementation.
3. Preserve the separation between author-facing facade, privilege-bearing port, and host realization.
4. Implement the smallest portable semantic owner and explicit dependency graph. Define missing-capability behavior and the full resource lifetime.
5. Add owning-layer tests first when restoring an existing guarantee. Add Adapter or Runtime evidence only for behavior those layers actually exercise.
6. Identify any required spec-entity or public-projection transition in the handoff without loading another skill.
7. Record the focused Module, Runtime, Adapter, graph, projection, and type validation boundary for a later `pui-validate` transition.

Stop if the work needs a new identity, public registration shape, ownership migration, portable baseline, dependency, or host fact not present in the approval. Do not pass raw host objects into portable state or infer conformance from source inspection.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep technical identifiers canonical.
