---
name: pui-regression
description: Reproduce and repair a bounded Proto UI regression whose expected behavior and owning layer are already governed. Use this before domain implementation skills whenever work starts from a reproducible failure, including bug fixes, drift repairs, broken exports, Runtime failures, Adapter parity defects, Prototype defects, or public-projection regressions. Do not use when expected semantics or ownership is unresolved.
---

# Repair a governed regression

1. Require a minimal reproduction, `pui-trace` map, fixed expected behavior, affected surfaces, and explicit exclusions.
2. Classify the owning layer before editing. Keep the regression transition primary even when the owning layer is an Adapter, Module, Host Capability, or Prototype; propose a domain leaf later only if a separately approved artifact must change.
3. Add or identify evidence that fails for the governed reason before the fix.
4. Repair the smallest owning layer. Preserve unrelated behavior and avoid opportunistic refactoring.
5. Update `T-*` mapping only to the extent the executable evidence proves.
6. Record another domain leaf in the handoff only when its governed artifact genuinely must change; do not load it here.
7. Record the focused failure/pass evidence, affected integration checks, and broader validation boundary for a later `pui-validate` transition.

Stop if the repair changes a normative criterion, owner, public API, compatibility promise, or lifecycle. Do not edit the spec to make the implementation pass, hide a lower-layer defect in a Prototype or stylesheet, or treat screenshots as sole protocol evidence.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep technical identifiers canonical.
