---
title: 'Projecting Base into a Design Language'
description: 'Deliver a design-language P entity, implementation, tests, exports, and demos without redefining Base semantics.'
---

Design-language projection is the clearest complete path for Prototype authors during the 0.3 phase. Its prerequisite is not merely that a component exists in a design system. Base must already own a reusable protocol, while the derived Prototype owns presentation and cataloged differences only.

## Preconditions

- The corresponding Base `P-*` entity and `T-*` evidence exist.
- The issue names the Base owner, derived identity, and lifecycle status.
- Base ownership of state, events, focus, accessibility, context, positioning, and host capabilities is explicit.
- Allowed design-language props, tokens, rules, anatomy, and compatibility scope are explicit.
- The governed Base subject and the intended derived delta are explicit; any genuinely new Base identity is kept as a candidate until its admission decision.

If any condition is missing, improve the issue and candidate graph while collecting focused evidence instead of inferring a boundary by copying another styled library. Existing governed projections continue while that evidence is refined.

## Base projection versus styled-only

### Base projection

When the design-language subject needs an existing Base information path, the derived P inherits Base through `inherits.prototypes` and the corresponding `asHook`. It may add presentation but must not create a competing owner.

### Styled-only

A subject that owns only design-language props, visual rules, a content model, or visual anatomy may still be a formal styled-only P without a Base counterpart. Never create an empty Base entity merely to obtain an inheritance hook.

Base admission requires an independent, cross-host, testable input-fact-to-observable-output path. A directory, anatomy name, or empty `asHook` is not evidence.

## Delivery sequence

### 1. Pin provenance and compatibility

For Shadcn, Lucide, or another third-party design language, record:

- exact upstream repository and path;
- revision, release, or commit;
- license and required notice;
- APIs, tokens, assets, or visual behavior copied, adapted, or used only for comparison; and
- upstream APIs explicitly unsupported or incompatible.

For an original design language, state that it is not an official integration, clone, or certified implementation of an unrelated system.

### 2. Author the derived P entity

The P entity should:

- point to the Base identity through `inherits.prototypes`;
- define criteria for the derived surface only;
- explicitly declare any setup-time negative patch and the Base capability it abandons or replaces;
- record design-language props, variants, tokens, visual anatomy, and compatibility boundaries; and
- map substantive `T-*` evidence and real source paths.

Do not copy every Base criterion into the derived P or promise unimplemented upstream APIs.

### 3. Build from the Base `asHook`

Implementation normally calls the Base `asHook` first, then adds:

- design-language props;
- `feedback.style` tokens;
- rules based on Base states or meta;
- necessary cataloged visual anatomy; and
- derived-library types and public entries.

If implementation begins to own Base value, event requests, focus, accessibility, dismissal, or positioning again, treat it as ownership drift: update the governing or candidate entities and tests, correct the implementation, and continue through fresh review. Escalate only if the evidence requires admitting a genuinely new Base identity.

### 4. Verify positive and absence guarantees

Focused tests should cover:

- consumption of the correct Base entry;
- design-language props and defaults;
- token and rule output in important states;
- continued absence of unsupported variants, events, parts, and compatibility APIs;
- absence of a second value, event, focus, activation, or accessibility owner; and
- exact package and root exports.

Screenshots or class-name assertions alone do not prove correct protocol inheritance.

### 5. Complete the delivery surface

Every new public Prototype identity or anatomy family must appear on a reachable website page in the same pull request. This projection is not optional at issue discretion. Connect the page to the appropriate library documentation entry and record its local route so reviewers can inspect it interactively.

The complete delivery surface includes:

- anatomy-family package subpaths;
- root compatibility exports;
- CLI registry and facade generation;
- component-preset and token closure;
- English and Chinese docs;
- a real public-package demo;
- Web Component, React, and Vue previews; and
- generated workspace and Agent projections.

Update generated files through their generators.

#### Make the website demo match installed usage

The website demo must consume the real public package export and use, as far as possible, only the anatomy, triggers, state, events, props, and defaults available after installing that Prototype. Do not rebuild a control flow at page level merely to make the component appear functional.

- A Dialog should request opening through its own Trigger, not through an unrelated Button callback that calls a Dialog expose.
- An autonomous Prototype should not gain an extra state or event owner for the demo.
- Page-private CSS, scripts, or fixtures must not hide a Prototype, Base-inheritance, or Adapter problem.
- The internal Demo Matrix supplements validation; it does not replace the website page.

Minimal external orchestration is allowed only when the Prototype has no natural trigger by design, or when its public controls are themselves the subject of the demo. Toast-style invocation and directly controlled Transition demos are typical exceptions. Keep the exception outside the Prototype, use public APIs only, and state in the demo source and pull request why it is unavoidable and which code consumers must recreate because it is not installed with the package.

## What continues through implementation and review?

For an existing governed Base subject, contributors and Agents can continue deciding reversible projection details while keeping the P/T graph, implementation, evidence, and public surface coherent:

- source-file organization;
- internal token and rule reuse;
- focused-test fixtures;
- how the demo communicates governed states; and
- local refactoring that preserves public semantics.

The same evidence-bound review loop handles:

- adding or removing public props, events, states, or anatomy identities;
- changing Base ownership;
- introducing a negative patch;
- widening a third-party compatibility claim;
- changing between projection and styled-only classification; or
- adding a dependency.

These are governed changes, not blanket human checkpoints. The one semantic decision to escalate is admission of a genuinely new independent Base identity. While that admission is unresolved, its research, candidate graph, draft entities, projection probes, and tests can continue without presenting it as an admitted guarantee.

## References

Read in this order:

1. the corresponding Base P/T entities and package source;
2. `packages/prototypes/shadcn/src/button/` and its tests;
3. `packages/prototypes/shadcn/src/switch/` and its tests; and
4. `packages/prototypes/brutalist/src/separator/` and its tests, to see the same Base protocol enter another design language.

Learn the ownership and evidence structure rather than copying files mechanically.

## Validation

Run focused Base and derived tests first, then:

```sh
corepack pnpm@10.32.1 check:styles:preset
corepack pnpm@10.32.1 check:component-presets
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 docs:build
```

Not every design library uses component presets. State which checks apply. Changes to the public package graph also need package build, manifest, and consumer smoke coverage.

Next: use the [Prototype Author Checklist](/en/build/prototypes/checklist/) before opening a pull request.
