---
name: pui-prototype
description: Maintain an existing Proto UI Prototype or implement an explicitly approved Base or design-language component slice. Use for governed component behavior, anatomy, inheritance, exports, CLI registration, style projection, demos, or public preview work. Do not use to admit a new semantic subject or invent Base ownership from a component name.
---

# Work on a Prototype or component slice

1. Require `pui-orient`, `pui-trace`, and the issue's implementation authorization.
2. Classify the work as maintenance, approved Base implementation, or approved design-language projection.
3. For maintenance, preserve existing criteria and add failing-before evidence at the owning layer.
4. For Base work, require approved independent subject, information ownership, negative boundary, public surface, test graph, and host prerequisites.
5. For design-language work, inherit Base semantics and own only the approved presentation, compatibility, anatomy, or style delta.
6. Keep source, types, exports, CLI surfaces, spec graph, tests, and reachable public package previews coherent.
7. Use the Prototype's public anatomy and behavior in demos. Do not simulate missing protocol in page code.
8. Record evidence, documentation, and validation as separate eligible handoffs. Do not load them inside this transition.

Stop if work creates new criteria, ownership, public API, raw host escape, incompatible Adapter semantics, negative patch, classification change, or dependency not covered by approval.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep public API names canonical.
