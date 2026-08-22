---
name: pui-adapter
description: Implement one explicitly approved Proto UI Adapter-profile realization slice. Use when target and runtime range, supported or omitted Module role, Host Capability fidelity, lifecycle translation, failure behavior, compatibility boundary, and evidence scope are already governed. Use pui-adapter-assess for research or readiness assessment and pui-regression first for a governed failing behavior.
---

# Implement one Adapter realization

1. Require current `pui-orient` and `pui-trace` artifacts plus explicit implementation authorization for the complete slice.
2. Read the approved decision or assessment packet, target Adapter profile, related Module and Host Capability entities, tests, current realization, and exact exclusions.
3. Confirm that identity, target and runtime range, support or omission role, capability fidelity, lifecycle ownership, failure behavior, compatibility, and evidence scope are fixed. When this transition is ineligible, identify the single appropriate registered leaf in the handoff without loading it.
4. Implement only the approved host translation. Do not redefine portable semantics to match one host or infer support from package structure.
5. Preserve uncataloged areas and explicit omissions outside the approved realization. Do not widen target support, dependencies, or public surface.
6. Return the actual diff, affected translation paths, direct and indirect consumers, exclusions, required evidence, and residual risks as the candidate-change artifact.

Stop for new Adapter admission, new portable semantics, new capability identity, unresolved lifecycle, dependency approval, incompatible host behavior, or any scope not present in the authorization. Do not catalog, validate, or document a wider slice inside this transition.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep target and API identifiers canonical.
