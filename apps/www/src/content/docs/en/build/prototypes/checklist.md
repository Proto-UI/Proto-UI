---
title: 'Prototype Author Checklist'
description: 'Check contribution readiness, spec ownership, evidence, and delivery before opening a Prototype pull request.'
---

## 1. Which contribution path am I following?

- Am I maintaining an existing P, projecting Base, or implementing an approved Base slice?
- Does the issue state what is decided, what I may decide, and what must not change?
- Does the issue authorize implementation, or does it still carry `needs maintainer design`?
- For a new Base subject, is the maintainer checkpoint recorded?

## 2. Did I start from applicable spec entities?

- Did I find the applicable `P-*` and `T-*` entities?
- Did I read lifecycle, criteria, relations, sources, revisions, and mapped tests?
- Did I avoid treating a legacy contract, old record, or current implementation as higher authority than the applicable P entity?
- If sources conflict, did I identify the drift explicitly?

## 3. Do I really need a new Prototype?

- Is this a new interaction or semantic subject rather than a new style?
- Can existing Prototypes or `asHook`s already express it?
- Is this composition rather than an independent protocol?

## 4. Is the boundary correct?

- Does the subject own an independent input-fact-to-observable-output path?
- Are Parts split by responsibility rather than DOM or visual regions?
- Did I avoid creating an identity that owns only a name or empty inheritance point?

## 5. Is this protocol semantics or host implementation?

- Did I keep host-specific behavior out of the Prototype?
- Did I avoid treating one Web Adapter technique as cross-host meaning?
- Am I hiding an Adapter parity problem in Prototype or CSS logic?

## 6. If compound, is the family explicit?

- Are anatomy roles, cardinality, and relations justified?
- Are Root, Part, and shared ownership separate?
- Does context contain shared protocol meaning rather than miscellaneous host or style details?

## 7. If projected, does it faithfully inherit Base?

- Does the derived P define delta criteria and connect Base through `inherits.prototypes`?
- Does implementation consume the Base `asHook` instead of rebuilding ownership?
- Is every negative patch explicit in the P entity?
- Are unsupported upstream APIs and compatibility limits documented?
- Should a subject with no Base protocol be styled-only rather than creating an empty Base identity?

## 8. Do authoring entries match the cataloged protocol?

- Does the applicable P entity require a direct Prototype, an authored asHook, or both?
- When direct and authored-asHook entries express one protocol, do they share implementation and remain in one P entity?
- Did I avoid adding an asHook merely for API symmetry?
- Did I avoid using one protocol-specific authored asHook as another Base protocol's behavior substrate?
- Does any configurable authored asHook stay within an explicitly governed contract?

## 9. Does the website demo represent installed usage?

- Does every new public Prototype identity or anatomy family have a reachable page connected to the website documentation entry point?
- Does the pull request provide a local preview route that maintainers can open directly?
- Does the demo consume the real public package export and provide applicable Web Component, React, and Vue previews?
- Does an autonomous Prototype work through its own anatomy, triggers, state, events, and default behavior?
- Did I avoid page state, unrelated Button callbacks, private CSS, or scripts added only to make the demo work?
- If the Prototype has no natural trigger or its public controls must be demonstrated, is external orchestration minimal and limited to public APIs?
- Does the demo source and pull request say which exception code is not installed with the package and must be recreated by consumers?
- Is the internal Demo Matrix treated as supplementary evidence rather than a replacement for the website page?

## 10. Is evidence coherent?

- Does every new or changed P criterion have a substantive `T-*` case?
- Do T cases anchor exact criteria and map real executable paths?
- Do focused tests verify positive results and required absence assertions?
- Do package exports, CLI, the website page, demos, and three-Adapter previews form a complete delivery surface?
- Were generated files updated through their generator?
- Does the pull request record the commands and manual validation actually performed?

Docs-only and demo-only fixes do not need artificial P/T entities. Any change to normative semantics or observable guarantees must update the applicable entities, evidence, and affected projections as one coherent change.
