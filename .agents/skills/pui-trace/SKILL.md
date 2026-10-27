---
name: pui-trace
description: Trace a Proto UI change through authoritative spec lifecycle, legacy explanation, dated context, implementation, executable evidence, package surfaces, and public projections. Use before deciding scope, changing behavior, reviewing a pull request, or investigating drift.
---

# Trace authority and evidence

Produce an authority map without changing behavior.

1. Read `AGENTS.md` and `spec/README.md` completely.
2. Search existing entity IDs, aliases, criteria, anchors, relations, revisions, sources, and lifecycle.
3. Follow the coherent chain from knowledge or decision through semantic owner, host boundary, Adapter profile, tests, implementation, exports, and documentation where applicable.
4. Use `internal/contracts/**` only for explanation or an uncataloged gap. Use dated records as context, never as project authority.
5. Distinguish governed fact, implementation evidence, public projection, observation, proposal, and unknown.
6. Treat implementation disagreement as drift to investigate, not an implicit spec amendment.
7. Record negative boundaries, direct and indirect consumers, generated projections, validation commands, and unresolved conflicts.

Return paths and entity anchors precise enough for another skill to act without repeating discovery. Stop at a contradiction that requires semantic choice.

Follow the [shared handoff and exact-action trust contract](../../../internal/agent-operations/contributor-agents.md#handoff-and-exact-action-trust) and return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Communicate with the user in the user's current language. Keep repository identifiers canonical.
