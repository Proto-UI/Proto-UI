---
title: 'Building a Styled Library on Top of Base'
description: 'Understand Base projections, styled-only identities, and design-language deltas.'
---

This page is a conceptual introduction. For a complete contribution, follow [Projecting Base into a Design Language](/en/build/prototypes/projecting-base-into-a-design-language/) for P/T, provenance, tests, exports, CLI, demos, and validation.

## Decide between projection and styled-only first

### Base projection

When Base already owns state, events, focus, accessibility, context, or positioning, a derived P connects to Base through `inherits.prototypes` and consumes the corresponding asHook in implementation. The derived layer adds only cataloged design-language deltas and never creates a second semantic owner.

### Styled-only

When a subject owns only design-language props, visual rules, a content model, or visual anatomy—and has no independent Base information path—it can be a formal styled-only P. Do not create an empty Base identity merely to obtain an inheritance entry.

Base admission requires an independent, cross-host, testable input-fact-to-observable-output path. A component directory or a familiar name from a popular design system is not evidence.

## The current shape of Shadcn Button

`P-SHADCN-BUTTON` currently declares one direct Prototype:

- `inherits.prototypes` points to `P-BASE-BUTTON`;
- [button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/shadcn/src/button/button.proto.ts) calls `asButton()`;
- it adds six `variant` values, four `size` values, and visual tokens;
- visual rules derive from inherited `hovered`, `focusVisible`, `pressed`, and `disabled` facts plus `colorScheme` meta;
- upstream `asChild` is explicitly unavailable, while other parity differences remain in a compatibility open question; and
- the Shadcn layer does not add another authored asHook.

The former guide listed `invalid` and `expanded` as current Shadcn Button rule inputs. The current implementation and passing P criteria do not provide that guarantee.

`P-BASE-BUTTON` and `P-SHADCN-BUTTON` are both currently `draft`. npm publication at 0.2.0 does not automatically make either entity active.

## What a derived P should contain

A reviewable design-language P focuses on its delta:

- exact upstream repository, path, revision, and provenance;
- `inherits.prototypes` or styled-only classification;
- variants, sizes, tokens, visual anatomy, and compatibility boundaries;
- any explicit setup-time negative patch and replacement semantics;
- unsupported upstream APIs; and
- substantive `T-*` evidence and real source paths.

Do not copy every Base criterion or promise upstream parity that has not been implemented.

## How implementation should reuse Base

Implementation normally calls the owning Base asHook first, then adds:

- design-language props;
- `feedback.style` tokens;
- rules based on Base state or meta;
- necessary cataloged visual anatomy; and
- derived types and public entries.

Pause and return to the issue if the implementation begins to own Base value, event requests, focus, accessibility, dismissal, or positioning again. The style layer must not become a second semantic truth.

## Negative patches and compatibility boundaries

A derived Prototype may abandon or replace an inherited guarantee during setup, but its own P criterion must identify:

- the Base capability being abandoned;
- the replacement semantics;
- the public compatibility impact; and
- absence assertions that prevent the capability from returning silently.

A runtime flag must not masquerade as a setup-time negative patch.

## Host and Adapter claims

The current Web Component, React, and Vue previews provide cross-Adapter evidence for one Web host profile. A design-language page may compare those Web projections, but it must not infer non-Web host conformance or claim identical APIs across every host.

## Next

- For the complete delivery workflow, read [Projecting Base into a Design Language](/en/build/prototypes/projecting-base-into-a-design-language/)
- To choose sources and evidence, read [How to Read Reference Implementations](/en/build/prototypes/reference-patterns/)
- Before opening a pull request, use the [Prototype Author Checklist](/en/build/prototypes/checklist/)
