---
title: 'How to Read Reference Implementations'
description: 'Move from P/T entities into source, tests, exports, and public projections without treating implementation as specification.'
---

Existing Prototype implementations are important evidence, but they are not the highest authority. Use this reading order:

```text
applicable P lifecycle and criteria
→ related decisions / contracts / inheritance
→ mapped T cases and executable paths
→ implementation and focused tests
→ exports, CLI, docs, demo
```

When implementation conflicts with an applicable entity, identify drift first. Do not silently change protocol meaning because “the repository currently does it this way.”

## 1. Find the applicable P/T graph

Search by name, ID, or criterion:

```sh
rg -n "<prototype name|entity id|criterion id>" spec packages/prototypes apps/www internal/records
```

Confirm:

- whether the P entity is `draft`, `active`, deprecated, or removed;
- which criteria apply to the current problem;
- how direct Prototypes, authored asHooks, and Parts are cataloged;
- `inherits.prototypes`, dependencies, and related decisions; and
- which executable tests the T cases map.

Legacy contracts and records can explain background. They cannot override an existing applicable spec entity.

## 2. Read a leaf Prototype

Button is a relatively small vertical slice:

- `P-BASE-BUTTON`;
- `T-BASE-BUTTON-0001`;
- [button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts); and
- `packages/prototypes/base/test/as-button.test.ts`.

Trace criteria into props, state, accessibility, events, exposes, and absence guarantees instead of recording only the order of API calls.

Toggle provides another independent Base protocol for comparison:

- `P-BASE-TOGGLE` and `T-BASE-TOGGLE-0001`; and
- [toggle.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/toggle/toggle.proto.ts).

Button and Toggle both having authored asHooks does not permit one protocol to consume the other's protocol-specific hook.

## 3. Read a compound family

Tabs requires Root and Parts together:

- `P-BASE-TABS` plus the List, Trigger, Content, and Indicator P entities;
- the corresponding `T-BASE-TABS-*` entities;
- [shared.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/shared.ts);
- [root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/root.proto.ts);
- [list.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/list.proto.ts);
- [trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/trigger.proto.ts);
- [content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/content.proto.ts); and
- [indicator.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/indicator.proto.ts).

Trace owners, context facts, anatomy claims, collection and focus responsibilities, and mapped tests. File count alone does not prove a correct boundary.

## 4. Read a design-language projection

Shadcn Button is a compact Base-projection example:

- `P-SHADCN-BUTTON` and `T-SHADCN-BUTTON-0001`;
- inherited `P-BASE-BUTTON` criteria;
- [Shadcn Button source](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/shadcn/src/button/button.proto.ts); and
- `packages/prototypes/shadcn/test/button.test.ts`.

Verify that:

- the derived P declares only its delta;
- implementation calls the owning Base asHook;
- rules depend on inherited protocol states instead of making host selectors a second truth;
- unsupported upstream APIs and absence assertions are recorded; and
- package exports, CLI facades, website demos, and the P/T surface agree.

Shadcn Switch and Tabs offer differently sized projections, but always begin from their own P/T graph rather than mechanically copying directory structure.

## 5. Finish with the public delivery surface

After source and tests, inspect:

- package subpaths and root exports;
- CLI registry and generated facades;
- component-preset or style-token closure when applicable;
- bilingual docs and a real public-package demo;
- Web Component, React, and Vue Web evidence; and
- generated workspace and Agent projections.

This distinguishes “implementation exists” from “the contribution forms a consumable, reviewable closure.”

## Lifecycle note

The Base Button, Toggle, Tabs, and Shadcn Button entities referenced here are currently `draft`. Learn from their ownership and evidence structure without widening current implementation details into uncataloged stable guarantees.

## Further reading

- [Maintaining an Existing Prototype](/en/build/prototypes/maintaining-an-existing-prototype/)
- [Projecting Base into a Design Language](/en/build/prototypes/projecting-base-into-a-design-language/)
- [Implementing an Approved Base Semantic Slice](/en/build/prototypes/implementing-an-approved-base-slice/)
