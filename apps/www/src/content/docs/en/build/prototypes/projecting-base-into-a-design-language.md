---
title: 'Projecting Base into a Design Language'
description: 'Deliver a styled Prototype—spec entity, implementation, tests, exports, CLI facade, and demos—on top of an existing Base protocol.'
---

Layering a design language onto an existing Base protocol is the most common end-to-end path for Prototype authors. Base handles the underlying interaction model, while the styled layer owns visual presentation, design-language APIs, and documented compatibility deltas.

## Prerequisites

Before starting, confirm that:

- the corresponding Base `P-*` entity and `T-*` tests already exist;
- the issue identifies the Base owner, target styled identity, and lifecycle status;
- Base responsibilities (state, events, focus, accessibility, Context, positioning, host capabilities) are clear; and
- the intended design-language props, tokens, `Rule`s, visual anatomy, and compatibility scope are defined.

If a genuinely new Base interaction protocol is needed first, keep the new Base identity in `draft` mode with focused probes and tests instead of guessing boundaries by copying another styled library.

## Base inheritance vs. styled-only

### Base inheritance

When a styled component builds on an existing Base interaction path, connect its spec via `inherits.prototypes` and call the Base `asHook` in code. The styled layer adds presentation without creating a competing state owner.

### Styled-only

When a component consists only of design-language props, visual rules, content layout, or visual anatomy—with no independent cross-host interaction protocol—author it directly as a formal `styled-only` Prototype. Never create an empty Base entity just to provide an inheritance hook.

## Delivery steps

### 1. Document provenance and compatibility

When adapting Shadcn, Lucide, or another third-party design system, record:

- the exact upstream repository and file path;
- the pinned revision, tag, or release;
- license and attribution notices;
- which APIs, tokens, assets, or visual patterns are adapted or referenced; and
- which upstream APIs are intentionally omitted or behave differently.

For an original design language, briefly document its scope and intent.

### 2. Author the derived `P-*` entity

Focus the derived `P-*` spec on its delta:

- link to Base through `inherits.prototypes`;
- write criteria for the styled layer only;
- document any setup-time negative patch and the replacement behavior;
- specify design-language props, variants, tokens, visual anatomy, and compatibility scope; and
- map real `T-*` test cases and source file paths.

Avoid copying Base criteria into the derived spec or listing unimplemented upstream APIs.

### 3. Implement on top of the Base `asHook`

Call the owning Base `asHook` first, then layer on:

- design-language props;
- `feedback.style` tokens;
- style `Rule`s keyed to Base states or metadata;
- cataloged visual anatomy; and
- library-specific types and public exports.

If the styled implementation starts tracking its own copy of Base values, event requests, focus, accessibility, dismissal, or positioning, realign the code and spec so Base remains the single source of truth.

### 4. Test both positive and negative guarantees

Focused tests should verify:

- the styled entry invokes the right Base entry;
- design-language props and defaults;
- token and `Rule` outputs across key interaction states;
- explicitly unsupported variants, events, parts, or upstream APIs remain absent;
- Base remains the sole owner of interaction state, focus, activation, and accessibility; and
- package subpath and root exports match the spec.

### 5. Complete the public delivery surface

Every new public Prototype or compound family ships with a reachable website page connected to library navigation in the same PR, along with its local preview route for reviewers.

The complete delivery surface typically includes:

- family package subpath exports;
- root compatibility exports;
- CLI registry entries and facade generation;
- component presets and style-token closure (for libraries using presets);
- English and Chinese docs;
- an interactive demo importing the real public package export;
- Web Component, React, and Vue previews; and
- regenerated workspace/derived files via their generators.

#### Keep the website demo faithful to installed usage

Demos should import from the public package subpath and rely on the component's own anatomy, triggers, states, events, and defaults:

- Open a Dialog through its own Trigger rather than calling an exposed method from an unrelated button.
- Avoid creating extra page-level state or event owners for autonomous components.
- Avoid page-private CSS, scripts, or fixtures that paper over Prototype or Adapter issues.

Only add minimal external glue using public APIs when the Prototype has no natural trigger by design (such as Toast invocation) or when demonstrating imperative controls directly (such as Transition). Document that external code in the demo source and PR so consumers know what is not bundled with the package.

## Collaboration scope during review

For an existing Base subject, contributors and reviewers can iterate directly on:

- source file layout and internal token/rule sharing;
- focused test fixtures and demo structure;
- adding or adjusting public props, events, states, anatomy, or negative patches;
- compatibility scope or `styled-only` classification adjustments; and
- new dependency decisions.

Only introducing a brand-new independent Base identity requires a separate Base-admission decision. While that decision is open, keep the candidate marked `draft` while continuing reversible implementation and tests.

## Reference implementations

Read these examples in order to see ownership and test structure in practice:

1. the target component's Base `P-*`/`T-*` entities and source;
2. `packages/prototypes/shadcn/src/button/` and its tests;
3. `packages/prototypes/shadcn/src/switch/` and its tests; and
4. `packages/prototypes/brutalist/src/separator/` and its tests (to see the same Base protocol styled for a different design language).

## Local checks

Run focused Base and styled-layer tests first, then run:

```sh
corepack pnpm@10.32.1 check:styles:preset
corepack pnpm@10.32.1 check:component-presets
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 docs:build
```

Not every styled library uses component presets—run the checks that apply to your library. If you touched package exports or dependencies, run package builds and manifest checks as well.

Next: run through the [Prototype Author Checklist](/en/build/prototypes/checklist/) before opening your pull request.
