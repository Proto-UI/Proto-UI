---
title: 'How to Read Reference Implementations'
description: 'Navigate from P/T spec entities into source code, tests, exports, and demos to learn Proto UI authoring patterns.'
---

When studying reference Prototypes in this repository, start from the spec entities and trace downward into code, tests, and consumer surfaces:

```text
Applicable P-* lifecycle and criteria
→ Related decisions, inheritance, and contracts
→ Linked T-* test cases and test files
→ Prototype implementation and focused tests
→ Exports, CLI, docs, and demos
```

Reading the spec first clarifies why the code is structured the way it is—and makes any drift between code and spec easy to spot.

## 1. Locate the applicable `P-*` and `T-*` entities

Search by name, entity ID, or criterion ID:

```sh
rg -n "<prototype name|entity id|criterion id>" spec packages/prototypes apps/www internal/records
```

Check five things first:

- the `P-*` entity's lifecycle status (`draft`, `active`, `deprecated`, or `removed`);
- which criteria apply to your task;
- how direct Prototypes, `asHook`s, and Parts are cataloged;
- `inherits.prototypes`, dependencies, and related decisions; and
- which executable tests the `T-*` cases map to.

Files under `internal/contracts` and `internal/records` provide helpful context, while applicable `spec/**` entities remain the primary source of truth.

## 2. Read a single-part Prototype

`Button` is a compact vertical slice:

- `P-BASE-BUTTON`;
- `T-BASE-BUTTON-0001`;
- [button.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/button/button.proto.ts); and
- `packages/prototypes/base/test/as-button.test.ts`.

Trace how each criterion translates into props, state, accessibility, events, exposes, and edge-case tests.

Compare it with `Toggle` to see a second independent Base protocol:

- `P-BASE-TOGGLE` and `T-BASE-TOGGLE-0001`; and
- [toggle.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/toggle/toggle.proto.ts).

Even though both export an `asHook`, each hook stays scoped to its own protocol rather than acting as the substrate for the other.

## 3. Read a compound family

For compound components like `Tabs`, read Root and Parts together:

- `P-BASE-TABS` along with the List, Trigger, Content, and Indicator entities;
- the matching `T-BASE-TABS-*` entities;
- [shared.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/shared.ts);
- [root.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/root.proto.ts);
- [list.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/list.proto.ts);
- [trigger.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/trigger.proto.ts);
- [content.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/content.proto.ts); and
- [indicator.proto.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/indicator.proto.ts).

Focus on state ownership, shared `Context` fields, `def.anatomy.claim()` declarations, collection/focus ownership, and family tests.

## 4. Read a styled component

`Shadcn Button` is a concise example of Base inheritance:

- `P-SHADCN-BUTTON` and `T-SHADCN-BUTTON-0001`;
- inherited `P-BASE-BUTTON` criteria;
- [Shadcn Button source](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/shadcn/src/button/button.proto.ts); and
- `packages/prototypes/shadcn/test/button.test.ts`.

Look for five patterns:

- the styled `P-*` entity declares only its delta over Base;
- the implementation calls the owning Base `asHook` first;
- style `Rule`s react to inherited protocol states instead of treating host selectors as a second state source;
- unsupported upstream APIs are documented and verified by tests; and
- package exports, CLI facades, website demos, and specs match.

You can also compare Shadcn Switch and Tabs to see how larger compound families are structured.

## 5. Check the public delivery surface

After reading code and tests, inspect the consumer-facing surface:

- package subpaths and root exports;
- CLI registry entries and generated facades;
- component presets and style-token closure (where applicable);
- bilingual docs and real public-package demos;
- Web Component, React, and Vue previews; and
- generated workspace and derived doc artifacts.

> Note: The Base Button, Toggle, Tabs, and Shadcn Button spec entities referenced here are currently `draft`; check the spec files for their latest definitions.

## Further reading

- [Maintaining an Existing Prototype](/en/build/prototypes/maintaining-an-existing-prototype/)
- [Projecting Base into a Design Language](/en/build/prototypes/projecting-base-into-a-design-language/)
- [Implementing a Governed Base Semantic Slice](/en/build/prototypes/implementing-an-approved-base-slice/)
