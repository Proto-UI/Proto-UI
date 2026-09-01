---
name: pui-host
description: Implement or revise one governed Proto UI Host Capability connecting a semantic Module to a bounded host responsibility. Use when capability identity, portable need, public shape, availability, failure, replacement, cleanup, fidelity, Adapter realization, and evidence are fixed by current authority.
---

# Implement a Host Capability slice

1. Require a `pui-trace` map and current-user or standing authorization for the governed capability boundary.
2. Read the owning semantic criteria, Module, Host Capability, Adapter profile, test entities, and current realization.
3. Model the smallest host responsibility that satisfies the portable need. Keep independently failing responsibilities separate.
4. Define availability, atomicity, failure, lifetime, replacement, cleanup, and terminal behavior.
5. Keep framework and host objects behind the capability boundary.
6. Add fake-host evidence for portable semantics and real Adapter evidence for declared realization fidelity.
7. Keep governed-entity and validation work as separate candidate handoffs. Do not load another skill in this transition.

Keep implementation tokens, mixed ownership, raw-host leakage, and unsupported provision claims out of the change. Route only a genuinely new portable guarantee or unresolved capability identity to an attended product-direction decision.

## Explicit handoff

Do not load or execute another skill. Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`. Carry required prior artifacts by reference, include every artifact this leaf produces according to `skills.yaml`, and set `nextSkillId` to one eligible registered leaf or `null`.

Communicate with the user in the user's current language. Keep technical identifiers canonical.
