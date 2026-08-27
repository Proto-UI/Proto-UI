---
name: pui-spec
description: Create or revise a Proto UI spec entity after identity, ownership, lifecycle intent, semantic scope, relations, and evidence plan are already governed. Use for approved Contract, Prototype, Module, Adapter profile, Decision, Host Capability, Test, Version, or Knowledge entity work. Do not use to decide admission or promote lifecycle.
---

# Author an approved spec change

1. Read `AGENTS.md`, `spec/README.md`, the schema, relevant engine validation, and the complete approved decision packet.
2. Require a `pui-trace` map and recorded authorization for identity, owner, lifecycle intent, semantic boundary, compatibility, and evidence scope.
3. Search existing IDs and relations again before creating anything.
4. Model one coherent semantic slice. Write addressable criteria, precise directional relations, version bounds, sources, open questions, and revisions where semantics changed.
5. Add or update `T-*` evidence and real executable implementation paths for normative behavior.
6. Change generated projections through their generators.
7. Record spec graph, catalog, projection, focused evidence, and proportional type checks for a later `pui-validate` transition.

Stop if schema design, ownership, public surface, compatibility, lifecycle promotion, or evidence meaning remains undecided. Do not create inventory placeholders or infer a matrix from files, dependencies, packages, or names.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Preserve canonical identifiers and governed localization.
