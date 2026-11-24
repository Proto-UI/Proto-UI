---
title: 'Why You Usually Do Not Need a New Prototype'
description: 'Distinguish maintenance, host-level composition, design-language styling, and a genuinely new Base protocol before writing code.'
---

Most UI work in Proto UI builds on existing protocols rather than introducing new ones. Before creating a new Prototype, start here:

> Locate the relevant `P-*` and `T-*` spec entities first, then decide whether your task is **maintenance**, **host-level composition**, **design-language styling**, or a genuinely new **Base protocol**.

Existing cataloged subjects move straight into maintenance, styling, or implementation. For a genuinely new Base identity, start in `draft` mode with research, candidate specs, implementation probes, and tests, then follow [Implementing a Governed Base Semantic Slice](/en/build/prototypes/implementing-an-approved-base-slice/) once admitted.

## Identify the right path first

### 1. Maintain an existing Prototype

If an applicable `P-*` entity already exists and behavior, tests, exports, CLI facades, docs, or demos diverge from it, follow [Maintaining an Existing Prototype](/en/build/prototypes/maintaining-an-existing-prototype/).

### 2. Compose existing components

If you want to combine existing components into a higher-level UI pattern (such as a searchable modal or toolbar), keep that composition in your host framework or compiler layer. Per `K-PROTOTYPE-COMPOSITION-0001`, Proto UI's core template language models structure within a single Prototype rather than nesting one Prototype inside another.

Keep app-level composition out of Base—there is no need to create a new Base identity just for a convenient wrapper name.

### 3. Layer a design language onto Base

When Base already handles state, events, focus, accessibility, or context, and your changes focus on:

- `variant`, `size`, or visual anatomy;
- design tokens and `Rule` definitions;
- upstream design-system API compatibility; or
- explicit visual or API additions;

build a Base-backed styled component (or a styled-only Prototype when no Base interaction protocol is needed). Follow [Projecting Base into a Design Language](/en/build/prototypes/projecting-base-into-a-design-language/) for the end-to-end workflow.

### 4. Propose a new Base protocol

Introduce a new Base Prototype only when a pattern owns an independent, cross-host, testable interaction model:

- clear input facts and state ownership;
- explicit observable outputs and synchronization rules;
- semantics that existing Base protocols or composition cannot express cleanly;
- clear boundaries separating interaction logic from styling, layout, forms, or business state; and
- criteria that map directly to executable `T-*` tests.

## When to use `asHook`

An `asHook` is a reusable authoring entry for a specific protocol, not a mandatory pair for every Prototype.

- `P-BASE-BUTTON` exposes both `base-button` and `asButton` as two entries for one Button protocol; [button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts) shares `setupButton` between them so behavior stays unified.
- `P-SHADCN-BUTTON` exposes only a direct Prototype entry, with no extra `asHook`.

Keep three guidelines in mind:

- check that an existing `asHook` belongs to the `P-*` protocol you intend to reuse;
- keep protocol-specific hooks like `asButton` scoped to their own protocol rather than using them as generic building blocks for unrelated Base protocols; and
- add an `asHook` only when there is a real authoring reuse case, not for symmetry alone.

## A quick pre-coding check

Answer these five questions in order before writing code:

1. Does an applicable `P-*`/`T-*` entity already exist for this behavior?
2. Can host- or framework-level composition solve this directly?
3. Is this a design-language layer over existing Base semantics?
4. If it is a new Base protocol, is it clearly tracked as a `draft` candidate or already admitted?
5. Are state ownership, public boundaries, related specs, and test plans clear?

If any of the first three apply, jump straight into that workflow. Otherwise, begin with a candidate spec, minimal implementation probe, and tests.

> Note: `P-BASE-BUTTON` and `P-SHADCN-BUTTON` referenced on this page are currently `draft` entities; check the spec files for their latest definitions.

## Next steps

- Learn the structure of a single-part Prototype: [Writing a Custom Primitive Prototype](/en/build/prototypes/writing-a-custom-primitive-prototype/)
- Learn how to model multi-part families: [Writing a Compound Prototype](/en/build/prototypes/writing-a-compound-prototype/)
- Learn how to build a styled library over Base: [Building a Styled Library on Top of Base](/en/build/prototypes/building-a-styled-library-on-top-of-base/)
