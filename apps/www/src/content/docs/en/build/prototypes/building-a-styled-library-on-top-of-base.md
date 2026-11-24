---
title: 'Building a Styled Library on Top of Base'
description: 'Understand Base inheritance, styled-only Prototypes, style Rules, and negative-patch boundaries.'
---

This page introduces the architecture behind styled Prototype libraries in Proto UI. When you are ready to ship a full styled component PR, pair it with the step-by-step workflow in [Projecting Base into a Design Language](/en/build/prototypes/projecting-base-into-a-design-language/).

## Choose between Base inheritance and styled-only

### Inheriting from Base

When a component relies on Base for state, events, focus, accessibility, Context, or positioning, link its spec to Base via `inherits.prototypes` and call the corresponding Base `asHook` in code. The styled layer adds only design-language presentation and cataloged deltas while Base remains the single source of interaction state.

### Styled-only

When a component consists solely of design-language props, visual rules, content layout, or visual anatomy—with no independent cross-host interaction protocol—define it directly as a `styled-only` Prototype. There is no need to create an empty Base entity just to have something to inherit from.

## Example: Shadcn Button

`P-SHADCN-BUTTON` illustrates a compact styled Prototype:

- links to `P-BASE-BUTTON` through `inherits.prototypes`;
- calls `asButton()` inside [button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/shadcn/src/button/button.proto.ts) to reuse Base button behavior;
- adds six `variant` values, four `size` values, and visual tokens;
- maps inherited `hovered`, `focusVisible`, `pressed`, and `disabled` states plus `colorScheme` metadata to style `Rule`s;
- documents that upstream `asChild` is not supported on this surface; and
- exposes only a direct Prototype entry without an extra `asHook`.

> Note: `P-BASE-BUTTON` and `P-SHADCN-BUTTON` are currently `draft` entities; check the spec files for their latest definitions.

## What belongs in a styled `P-*` entity

Keep a derived `P-*` spec focused on its delta:

- upstream repository, path, revision, and license attribution (when adapting an existing design system);
- `inherits.prototypes` link or `styled-only` classification;
- added variants, sizes, tokens, visual anatomy, and compatibility scope;
- explicit setup-time negative patches and their replacement semantics;
- explicitly unsupported upstream APIs; and
- linked `T-*` test cases and real source file paths.

Avoid duplicating Base criteria in the derived spec, and document only compatibility behaviors that are actually implemented.

## Reusing Base in implementation

A typical styled Prototype calls its Base `asHook` first, then layers on:

- design-language props;
- `feedback.style` tokens;
- `Rule`s driven by Base state or metadata;
- cataloged visual anatomy; and
- library-specific types and public package exports.

Keep value, event requests, focus, accessibility, dismissal, and positioning inside Base. If the styled layer starts tracking duplicate interaction state, revisit the spec boundary so ownership stays in one place.

## Negative patches and compatibility boundaries

A styled Prototype can opt out of or replace an inherited Base capability during `setup`. Document each negative patch in the derived `P-*` criteria:

- which Base capability is removed or replaced;
- the replacement behavior;
- any compatibility impact for consumers; and
- tests confirming the opted-out capability remains absent.

Declare capability overrides statically during `setup` rather than toggling them with runtime flags.

## Preview scope

Website previews compare Web Component, React, and Vue output under the Web host profile. For non-Web hosts, check the target host documentation for supported capabilities.

## Next steps

- Full end-to-end delivery workflow: [Projecting Base into a Design Language](/en/build/prototypes/projecting-base-into-a-design-language/)
- Navigate specs, source, and tests: [How to Read Reference Implementations](/en/build/prototypes/reference-patterns/)
- Review before opening a PR: [Prototype Author Checklist](/en/build/prototypes/checklist/)
