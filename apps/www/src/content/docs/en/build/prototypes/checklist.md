---
title: 'Prototype Author Checklist'
description: 'Review contribution path, spec ownership, boundaries, tests, and website demos before opening a Prototype pull request.'
---

Run through this checklist before starting work or opening a pull request to keep specs, code, tests, and docs aligned.

## 1. Confirm the contribution path

- You know whether you are maintaining an existing `P-*`, building a styled component over Base, or implementing a new Base semantic slice.
- The issue states the scope and expected validation clearly.
- Any brand-new Base identity remains marked `draft` until admission is decided.

## 2. Start from applicable spec entities

- You located the applicable `P-*` and `T-*` entities.
- You checked their lifecycle status, criteria, inheritance, sources, and mapped test paths.
- When code and spec conflict, you treat the `P-*` entity as the baseline and resolve the drift explicitly.

## 3. Confirm a new Prototype is needed

- The work models a distinct interaction subject, not just a new visual theme.
- Existing Prototypes and `asHook`s cannot express it cleanly.
- It belongs as an independent protocol rather than host-level component composition.

If any answer is no, revisit [Why You Usually Do Not Need a New Prototype](/en/build/prototypes/when-not-to-write-a-new-prototype/).

## 4. Check component boundaries

- The Prototype owns an independent, testable input-to-output interaction path.
- Parts are split by responsibility rather than visual wrappers, without cramming unrelated duties into one Prototype or inventing empty identities.

When unsure about boundaries, read [Chapter 3: Component Boundaries](/en/whitepaper/3-component-boundary/).

## 5. Keep interaction semantics host-neutral

- Host- or framework-specific behavior stays out of the Prototype.
- Adapter-specific details are not leaked into cross-host protocols, and Prototype workarounds are not used to hide Adapter parity gaps.

## 6. Compound family structure

- `Anatomy` roles, cardinality, and containment relations are clear and justified.
- Root, Part, and shared responsibilities are cleanly separated under explicit state owners.
- `Context` carries only shared protocol facts, free of host objects or theme-private styling details.

## 7. Styled library inheritance

- The styled layer adds `variant`, `size`, tokens, and style `Rule`s while reusing Base interaction behavior via its `asHook`.
- The derived `P-*` entity links to Base through `inherits.prototypes` and documents only its delta criteria.
- Any setup-time negative patch is declared in the spec and backed by tests.
- Unsupported upstream APIs and compatibility limits are clearly documented.
- Visual-only components without a Base interaction protocol use `styled-only` directly instead of creating empty Base identities.

## 8. Authoring entries and `asHook`s

- Direct Prototype and `asHook` exports match the applicable `P-*` entity.
- When both direct and `asHook` entries exist for one protocol, they share one core implementation and live in the same `P-*` entity.
- No empty `asHook` was added for symmetry alone, and no protocol-specific `asHook` is reused as a substrate for an unrelated Base protocol.
- Any configurable `asHook` stays within an explicit contract.

## 9. Website demos reflect real usage

- Every new public Prototype or compound family includes a reachable website page connected to library navigation and notes the local preview route in the PR.
- The demo imports the real public package export and covers applicable Web Component, React, and Vue previews.
- Autonomous components work via their own Anatomy, triggers, states, events, and defaults without extra page state, unrelated button callbacks, or private CSS workarounds.
- When a component has no natural trigger or demonstrates imperative controls, external glue stays minimal, uses public APIs only, and explains in the demo source and PR what consumers need to wire up themselves.

## 10. Tests and delivery closure

- Every new or changed `P-*` criterion maps to a concrete `T-*` case and executable test path.
- Focused unit tests verify both expected behavior and explicit absence assertions.
- Package exports, CLI facades, website docs, demos, and three-Adapter previews stay in sync.
- All generated files were updated through their generators.
- The PR lists the check commands and manual verification actually performed.

> Pure doc or demo fixes that do not alter public semantics do not need new `P-*`/`T-*` entities. Any change to normative behavior or observable guarantees should update specs, tests, and docs together in one PR.
