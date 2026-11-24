---
title: 'Prototype Contribution Paths'
description: 'Practical guides for maintaining existing Prototypes, building styled libraries on Base, and implementing Base protocols.'
---

These guides help contributors maintain, extend, and review Proto UI Prototypes. Every workflow starts from the cataloged `P-*` and `T-*` spec entities so behavior, tests, exports, and docs stay aligned.

## Choose a contribution path

### Maintain an existing Prototype

Start from the applicable `P-*` and `T-*` entities, implementation, and docs. Use this path for behavior fixes, regression tests, export or CLI updates, and doc/demo alignment.

[Read Maintaining an Existing Prototype](/en/build/prototypes/maintaining-an-existing-prototype/)

### Project Base into a design language

When Base already owns the interaction protocol, the styled layer adds design-language props, tokens, `Rule` definitions, visual anatomy, and clear compatibility notes. This is the most common end-to-end path for Prototype authors.

[Read Projecting Base into a Design Language](/en/build/prototypes/projecting-base-into-a-design-language/)

### Implement a governed Base semantic slice

Designed for contributors working on core interaction protocols. Existing Base subjects proceed directly from their `P-*` and `T-*` specs. For a brand-new Base identity, start with research, draft entities, implementation probes, and tests to make the admission decision concrete.

[Read Implementing a Governed Base Semantic Slice](/en/build/prototypes/implementing-an-approved-base-slice/)

Every new public Prototype should ship with a reachable website page and a demo importing the real public package export in the same pull request. Drive demos through the Prototype's own anatomy and triggers whenever possible; use minimal external glue code only when the component has no natural trigger or when demonstrating imperative controls. Review the [Prototype Author Checklist](/en/build/prototypes/checklist/) before opening a PR.

## Recommended reading order

If you are still deciding how to approach a feature or component:

1. [Why You Usually Do Not Need a New Prototype](/en/build/prototypes/when-not-to-write-a-new-prototype/) — distinguish maintenance, composition, styling, and new Base protocols
2. [Writing a Custom Primitive Prototype](/en/build/prototypes/writing-a-custom-primitive-prototype/) — learn the minimal structure of a single-part Prototype and its `asHook`
3. [Writing a Compound Prototype](/en/build/prototypes/writing-a-compound-prototype/) — model `Anatomy`, `Context`, and multi-part ownership
4. [Building a Styled Library on Top of Base](/en/build/prototypes/building-a-styled-library-on-top-of-base/) — layer variants, tokens, and `Rule`s onto Base
5. [How to Read Reference Implementations](/en/build/prototypes/reference-patterns/) — navigate from `P-*`/`T-*` entities into source code and tests

## Scope notes

For adapter authoring status and boundaries, see the [Adapter Contribution Guide](/en/build/adapter-guide/).

To browse all implemented component families and their documentation pages, see [Prototype Documentation Coverage](/en/build/prototypes/documentation-coverage/).
