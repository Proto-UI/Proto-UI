---
title: 'Why You Usually Do Not Need a New Prototype'
description: 'Distinguish maintenance, composition, design-language projection, and a new Base semantic subject.'
---

Proto UI provides Prototype authoring APIs, but that does not mean contributors should frequently add new protocol identities. A safer starting point is:

> Find the applicable `P-*` and `T-*` entities first, then decide whether the work is maintenance, composition, a design-language projection, or a new Base semantic subject that still needs approval.

This is a boundary guide, not authorization to implement a new Prototype. A new Base subject must pass a proposal and maintainer checkpoint. Implementation begins only after its boundary, public API, P/T graph, and evidence scope are approved; then follow [Implementing an Approved Base Semantic Slice](/en/build/prototypes/implementing-an-approved-base-slice/).

## Identify the kind of work first

### Maintain an existing Prototype

When an applicable `P-*` already exists and behavior, tests, exports, CLI, docs, or demos disagree with it, follow [Maintaining an Existing Prototype](/en/build/prototypes/maintaining-an-existing-prototype/).

### Compose existing capabilities

When the goal is to compose existing components or Prototypes into a higher-level experience, that composition normally belongs to the host, framework, or compiler layer. `K-PROTOTYPE-COMPOSITION-0001` states that the core template language does not provide prototype-to-prototype composition.

Do not create a Base identity merely to obtain a convenient directory name or composition entry point.

### Project a design language

When Base already owns state, events, focus, accessibility, or context semantics, and the change is mainly:

- variants, sizes, or visual anatomy;
- style tokens and rules;
- an upstream design-system compatibility boundary; or
- an explicit visual or API delta;

the subject is more likely a Base projection or styled-only Prototype. See [Projecting Base into a Design Language](/en/build/prototypes/projecting-base-into-a-design-language/) for the complete workflow.

### Propose a new Base semantic subject

A subject merits a proposal only when it owns an independent, testable, cross-host-stable information path:

- input facts and their owner are explicit;
- observable outputs and synchronization rules are explicit;
- existing Base protocols or composition cannot express it without loss;
- visual, business, layout, Form, and announcement responsibilities outside its ownership are explicit negative boundaries; and
- every retained criterion can map to substantive executable evidence.

A familiar component name, a directory in a popular design system, or a styled library's desire for an inheritance point is not Base-admission evidence.

## What `asHook` can solve—and what it cannot prove

An `asHook` is an authoring entry for a particular protocol. It is not a universal requirement to extract a hook whenever reuse seems possible.

`P-BASE-BUTTON` catalogs `base-button` and `asButton` as two authoring entries of the same Button protocol; the [Button source](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts) makes both share `setupButton`. In contrast, `P-SHADCN-BUTTON` explicitly has a direct entry and no additional authored asHook.

Therefore:

- confirm that an existing protocol-specific asHook belongs to the applicable P entity before using it;
- do not use a hook such as `asButton` as generic behavior substrate for another Base protocol;
- do not add an empty asHook merely for file or API symmetry; and
- let the entity boundary and real authoring surface decide whether direct and authored-asHook entries both exist.

## A practical decision line

Before writing code, answer these questions in order:

1. Is there an applicable P/T graph that makes this maintenance?
2. Is this host- or framework-level composition?
3. Is this only a design-language delta over existing Base semantics?
4. If it is a new Base subject, has the issue recorded a maintainer checkpoint?
5. Are lifecycle, criteria, relations, sources, and evidence explicit?

Until the first four steps are resolved, do not start by creating a Prototype file.

## Lifecycle note

`P-BASE-BUTTON` and `P-SHADCN-BUTTON`, referenced here, are currently `draft`. They describe the current cataloged direction and must not be presented as stable protocol guarantees merely because their packages were published in 0.2.0.

## Next

- To understand the structure of a leaf authoring entry, read [Writing a Custom Primitive Prototype](/en/build/prototypes/writing-a-custom-primitive-prototype/)
- For an approved compound boundary, read [Writing a Compound Prototype](/en/build/prototypes/writing-a-compound-prototype/)
- For a new design language, read [Building a Styled Library on Top of Base](/en/build/prototypes/building-a-styled-library-on-top-of-base/)
