---
name: pui-brainstorm
description: Investigate a bounded Proto UI Contract, Prototype, Module, Host Capability, Adapter, schema, or ownership question and turn it into a maintainer decision packet. Use for spec brainstorming, admission questions, competing semantic models, uncataloged behavior, or unresolved cross-layer boundaries. Stop before normative authoring or implementation.
---

# Shape a semantic decision

1. Require a bounded question and a `pui-trace` authority map.
2. Separate observed facts from hypotheses and desired behavior.
3. Trace the information path from input fact through semantic owner to observable output and synchronization boundary.
4. Identify candidate owners, portable invariants, host responsibilities, negative boundaries, compatibility effects, alternatives, and evidence needed to falsify each claim.
5. State what remains uncataloged and what existing lifecycle permits.
6. Produce one decision packet: question, evidence, competing choices, recommendation, exclusions, residual risks, proposed entity and test graph, and the smallest human decision needed.

Do not create a normative entity, approve admission, select ownership, widen a public guarantee, or start implementation. Preserve the packet in a dated record only when the user has authorized that repository change.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Author governed repository artifacts in their required language and keep technical identifiers canonical.
