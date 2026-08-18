---
title: 'How to Read Specs'
desp: 'Authority, lifecycle, relations, and a practical reading path for the Proto UI catalog'
description: 'Authority, lifecycle, relations, and a practical reading path for the Proto UI catalog'
---

The Specifications section is the public reading guide to Proto UI's machine-governed entity catalog. It helps you answer “what does the project currently guarantee?”, trace a rule to evidence, and distinguish a stable contract from work that is only cataloged as current direction.

The catalog is intentionally incomplete. Presence does not imply stability, and absence does not imply that an implementation has no behavior.

## Authority

When sources disagree, use this order:

1. An applicable entity in `spec/**` is authoritative.
2. Internal contract prose can fill an uncataloged gap, but cannot override an entity.
3. Engineering records preserve observations, alternatives, and time-bound direction; they are not normative.
4. Implementation and tests show current behavior. A mismatch with an entity is drift to investigate, not an implicit contract change.
5. This website and package READMEs are reader-facing projections and should be corrected when they drift.

The pages in this section explain the catalog; they do not create a second source of truth. Use the entity ID and criterion ID when a review or implementation needs an exact, stable reference.

## Entity types

| Prefix | Entity | Responsibility |
| --- | --- | --- |
| `C-` | Contract | Cross-cutting protocol rules and acceptance criteria |
| `P-` | Prototype | Official prototype or prototype-part identity and behavior |
| `M-` | Module | Semantic module identity and the contracts it satisfies |
| `A-` | Adapter | Official Adapter profile, target runtime, and reviewed support decisions |
| `D-` | Decision | Stabilized design or governance choice |
| `HC-` | Host capability | Capability expected from or projected to a host |
| `T-` | Test | Conformance case and executable evidence mapping |
| `V-` | Version | Release identity, channel, package policy, and publication evidence |
| `K-` | Knowledge | Shared vocabulary and explanatory model |

Entities form a typed graph. Relations such as `satisfies`, `verifies`, `supports`, `provides`, and `omits` connect a rule to ownership and evidence. For Adapter profiles specifically, a module missing from both `supports` and `omits` is **uncataloged**—not implicitly supported or unsupported.

## Lifecycle is separate from release version

Every entity has a `since` version and a lifecycle status:

| Status       | Meaning                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| `active`     | Current applicable guarantee                                                 |
| `draft`      | Cataloged current direction, not a stable public guarantee                   |
| `deprecated` | Kept for compatibility or migration; read `deprecatedSince` and `replacedBy` |
| `removed`    | Historical and unavailable from `removedSince` onward                        |

Do not collapse three different things into one “current version”:

- `V-PROTO-UI-0008` records the published, immutable **0.2.0 stable** ecosystem snapshot.
- The checked-out catalog is the current workspace projection and may include later draft work.
- At the time of this page, `V-PROTO-UI-0009` describes a **draft 0.3.0-alpha.0** release train; it is not publication evidence.

A package being published in 0.2.0 does not automatically make every related entity `active`. Read the entity lifecycle and the release evidence independently.

## A practical reading path

Start with [Core](/en/specifications/core/) for the portable boundary and authoring phases. Then follow the capability that owns your question:

- [Lifecycle](/en/specifications/lifecycle/), [Template](/en/specifications/template/), and [Props](/en/specifications/props/)
- [Event](/en/specifications/event/), [Expose](/en/specifications/expose/), and [State](/en/specifications/state/)
- [Context](/en/specifications/context/), [Anatomy](/en/specifications/anatomy/), and [Feedback](/en/specifications/feedback/)
- [asHook](/en/specifications/as-hook/) and [Rule](/en/specifications/rule/)

For an exact claim, continue from the named entity to its criteria, relations, sources, and `T-*` evidence. For motivation, return to the Whitepaper. For implementation mechanics, continue to Engineering or Reference.
