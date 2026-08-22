---
name: pui-docs
description: Update Proto UI human documentation, localized pages, contributor guidance, demos, or package prose as a projection of governed repository facts. Use when the reader problem and source authority are known. Do not use documentation to invent semantics, hide drift, or widen a lifecycle guarantee.
---

# Maintain human documentation

1. Read the target document completely, including its original purpose, neighboring navigation, other locale, linked entities, and real implementation surface.
2. Require a `pui-trace` map. State which source owns every behavioral claim.
3. Preserve the document's role: entry pages route readers, governance pages define stable process, dated records preserve current observations, and public pages explain governed behavior.
4. Write for the intended reader. Use direct sentences, define necessary terms, remove stale relative time and mutable counts, and avoid defensive or promotional prose.
5. Keep locales semantically aligned without forcing identical phrasing. Keep identifiers and API names canonical.
6. Use real public exports and routes for demos. Do not add page-level behavior that pretends to be package behavior.
7. Change generated docs through their generator.
8. Record the proportional validation boundary and propose `pui-validate` in the handoff without loading it.

Stop if the text requires a new guarantee, public API advice, compatibility promise, unresolved Adapter path, or hidden implementation fix.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Author each repository document in its governed language.
