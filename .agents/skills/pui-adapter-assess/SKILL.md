---
name: pui-adapter-assess
description: Assess one bounded Proto UI Adapter question without changing repository or external state. Use for new-Adapter research, target compatibility, catalog readiness, reviewed Module support or omission evidence, Host Capability fidelity, lifecycle translation, dependency risk, or implementation readiness. Do not catalog, implement, repair, or approve the Adapter slice.
---

# Assess one Adapter question

1. Require current `pui-orient` and `pui-trace` artifacts for the bounded question.
2. Read the Adapter decision, cataloging guide, target profile when present, related Module and Host Capability entities, tests, current translation code, issue boundary, and exact exclusions.
3. Classify the question as new-Adapter research, catalog readiness, compatibility assessment, support or omission evidence, capability-fidelity assessment, or implementation readiness. Do not move between classes silently.
4. Inspect real translation behavior and executable evidence. Distinguish observed support, explicit omission, uncataloged scope, implementation attachment, and faithful realization.
5. Identify target and runtime range, lifecycle ownership, failure behavior, dependency implications, portable-semantic gaps, incompatible host behavior, and evidence still needed.
6. Return a read-only assessment packet containing facts, unknowns, recommendation, exclusions, residual risks, and one eligible next registered leaf. Use the schema's gate field only for an unresolved Adapter identity/semantics/compatibility choice or a privileged operation; otherwise route governed parity, evidence, and implementation work forward immediately. Do not load that next leaf.

Remain read-only. Do not create a support matrix from packages or dependencies, infer conformance from source attachment, edit catalog entities, or authorize implementation.

Follow the [shared handoff and exact-action trust contract](../../../internal/agent-operations/contributor-agents.md#handoff-and-exact-action-trust) and return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Communicate with the user in the user's current language. Keep target, entity, and API identifiers canonical.
