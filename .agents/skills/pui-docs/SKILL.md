---
name: pui-docs
description: Update Proto UI human documentation, localized pages, contributor guidance, demos, or package prose as a projection of governed repository facts. Use when the reader problem and source authority are known. Do not use documentation to invent semantics, hide drift, or widen a lifecycle guarantee.
---

# Maintain human documentation

Apply the [current release stages and completion policy](../../../internal/governance/release-0.3-plan.md). Keep 0.3 committed libraries distinct from WIP / Experimental 0.4 work. Complete the named reader-facing projection and validate its actual surface, then carry the satisfied criterion through review/integration and an authorized checkbox update; unrelated umbrella debt is not a reason to hide completed documentation work.

1. Read the target document completely, including its original purpose, neighboring navigation, other locale, linked entities, and real implementation surface.
2. Require a `pui-trace` map. State which source owns every behavioral claim.
3. Preserve the document's role: entry pages route readers, governance pages define stable process, dated records preserve current observations, and public pages explain governed behavior.
4. Write for the intended reader. Use direct sentences, define necessary terms, remove stale relative time and mutable counts, and avoid defensive or promotional prose.
5. Keep locales semantically aligned without forcing identical phrasing. Keep identifiers and API names canonical.
6. Use real public exports and routes for demos. Do not add page-level behavior that pretends to be package behavior.
7. Change generated docs through their generator. For illustrations, use `internal/agent-operations/diagram-design.md` to inventory existing assets, preserve source-grounded meaning, choose a suitable topology, and inspect actual localized/theme renders before publication.
8. Record the proportional validation boundary and propose `pui-validate` in the handoff without loading it.

Stop if the text requires a new guarantee, public API advice, compatibility promise, unresolved Adapter path, or hidden implementation fix.

Follow the [shared handoff and exact-action trust contract](../../../internal/agent-operations/contributor-agents.md#handoff-and-exact-action-trust) and return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Communicate with the user in the user's current language. Author each repository document in its governed language.
