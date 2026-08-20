---
title: 'Maintaining an Existing Prototype'
description: 'Start from applicable P/T entities, fix behavior, add evidence, and resolve public-projection drift.'
---

Maintaining an existing Prototype is the most direct engineering path into Proto UI. You do not need to prove that the Prototype should exist, but you must first determine what it currently promises and whether the problem belongs to implementation, evidence, or a public projection.

## Work that fits this path

- Fix behavior that conflicts with an existing `P-*` criterion.
- Add regression or characterization coverage for an existing guarantee.
- Repair package export, CLI registry, docs, or demo drift.
- Add missing Light, Dark, keyboard, narrow-screen, or three-Adapter evidence for a defined state.
- Correct provenance, upstream revision, or compatibility-boundary documentation.
- Remove a capability implication that the entity explicitly excludes.

Adding props, events, states, anatomy parts, or compatibility promises is usually more than maintenance. Determine whether the P criteria, revision, or a related decision must change first.

## 1. Find the applicable entity

Do not infer the rule from a filename. Search first:

```sh
rg -n "<prototype name|entity id|criterion id>" spec packages/prototypes apps/www internal/records
```

Confirm at least:

1. the applicable `P-*` entity and its status;
2. the relevant criterion;
3. mapped `T-*` entities and executable implementation paths;
4. Base inheritance, related decisions, and negative boundaries;
5. package source, tests, exports, CLI registry, docs, and demos; and
6. any newer relevant record that changes short-term direction.

`draft` is the current cataloged direction, not a stable public guarantee. `active` records a current stable guarantee. Treat an implementation conflict as drift rather than silently preferring the implementation.

## 2. Classify the problem

### Implementation drift

The entity and expected evidence are clear, but runtime behavior differs. Fix the implementation and add a test that fails before the fix.

### Evidence gap

Behavior may be correct, but a `T-*` case, focused test, three-Adapter preview, or real-consumer proof is missing. Add the smallest executable evidence without widening semantics.

### Projection drift

Implementation and entities agree, but exports, CLI, README, website, demos, or generated data differ. Change the governing input or handwritten projection and update generated output through its generator.

### Spec change

The expected behavior itself must change. Pause ordinary maintenance and describe the affected criterion, compatibility impact, alternatives, and required checkpoint in the issue before changing entity revisions, T evidence, and projections.

## 3. Keep the change coherent

For a behavior fix, inspect this chain:

```text
P criterion
→ T case and executable test
→ Prototype implementation
→ Base or design-language inheritance boundary
→ package exports and CLI surface when affected
→ docs, demo, and real preview
```

Not every node must change. The pull request should say which nodes were checked and why the others remain valid.

## Test principles

- Anchor tests to criteria or explicit existing behavior, not incidental implementation details.
- A behavior-fix test should fail before the implementation change.
- Styled states need positive evidence and assertions for capabilities that must remain absent.
- When semantics differ across Adapters, first determine whether ownership belongs to the Prototype or Adapter. Do not hide Adapter parity drift in Prototype-specific logic.
- Preserve owner and lifecycle boundaries in teardown, remount, and asynchronous tests.

Focused test example:

```sh
corepack pnpm@10.32.1 vitest run packages/prototypes/base/test/separator.test.ts
```

## Docs and demos

When a change affects public behavior, states, anatomy, styling, or recommended usage, update the existing website Prototype page in the same pull request. Tests-only changes, internal refactors, and fixes that leave the current preview accurate do not need a new page, but the pull request should explain why the existing page remains sufficient.

A demo is real public-package consumption evidence, not a second implementation. A website demo should approximate what a developer gets directly after installing the package:

- import from a public package subpath;
- expose the state or behavior being changed;
- use Web Component, React, and Vue previews when applicable;
- prefer the Prototype's own anatomy, triggers, state, events, and default behavior;
- avoid page-private CSS, scripts, or extra control logic that hides a protocol bug; and
- provide accessible names for interactive controls.

For example, a Dialog should open through `dialog-trigger`; do not make the demo work by calling a Dialog expose from an unrelated Button click callback. Minimal external control is acceptable only when the Prototype has no natural trigger by design, or when its public controls are themselves the behavior under demonstration. Toast-style invocation and directly controlled Transition demos are typical exceptions. Exception code must:

- remain outside the Prototype and use public APIs only;
- be no larger than the demonstration requires;
- be identified in the demo source and pull request as orchestration that is not installed with the package and must be recreated by a consumer; and
- never hide missing anatomy, incorrect ownership, or Adapter drift.

A new public Prototype is not ordinary maintenance. Its contribution must include a reachable website page connected to the documentation entry point and name the local preview route in the pull request. The internal Demo Matrix is supplementary evidence, not a substitute for that page.

## Before opening a pull request

```sh
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:types
```

For docs or demos, also run:

```sh
corepack pnpm@10.32.1 docs:build
```

Run the complete test suite when the impact justifies it. Record the focused tests, catalog, type, docs, and manual verification actually performed.

## When maintenance becomes design work

Return to the issue before continuing if you need to:

- add or change a P criterion;
- change ownership between Base and a styled projection;
- add an anatomy identity;
- promote a host fact into a cross-host protocol;
- resolve a contradiction where P, T, implementation, and docs do not reveal the drift direction; or
- widen a third-party compatibility claim.

Next: if the work adds a design-language surface over existing Base semantics, read [Projecting Base into a Design Language](/en/build/prototypes/projecting-base-into-a-design-language/).
