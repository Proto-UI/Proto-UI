---
title: 'Writing a Compound Prototype'
description: 'Model anatomy, ownership, context, and part responsibilities inside an approved boundary.'
---

A compound Prototype is not a large component split into more files. It begins as a set of approved protocol subjects, owners, and structural relations; source organization follows.

> This guide explains compound modeling. A new Base family still requires a proposal and maintainer checkpoint; implementation follows [Implementing an Approved Base Semantic Slice](/en/build/prototypes/implementing-an-approved-base-slice/).

## Read the P/T graph before splitting DOM

Tabs is a representative current example. Inspect at least:

- `P-BASE-TABS` and its Root-owned selection criteria;
- `P-BASE-TABS-LIST`, `P-BASE-TABS-TRIGGER`, `P-BASE-TABS-CONTENT`, and `P-BASE-TABS-INDICATOR`;
- the corresponding `T-BASE-TABS-*` entities and executable mappings;
- [shared.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/shared.ts) and the `*.proto.ts` implementations; and
- `packages/prototypes/base/test/tabs.test.ts`.

These P entities are currently `draft`, so the example describes the current cataloged direction—not a stable guarantee created automatically by the 0.2.0 package version.

## Tabs anatomy currently has five roles

The canonical anatomy in `P-BASE-TABS` defines:

| Role | Cardinality | Current responsibility |
| --- | --- | --- |
| `root` | `1..1` | selected-value owner, context provider, and anatomy-domain anchor |
| `list` | `0..1` | trigger collection and roving-focus owner |
| `trigger` | `0..*` | requests selection using its own value |
| `content` | `0..*` | projects tabpanel visibility and presence from its value |
| `indicator` | `0..*` | context-driven visual consumer with no selection, focus, or event ownership |

The former four-part list omitted Indicator and no longer represents the current family.

Anatomy declares roles, cardinality, and `contains` relations. It does not create parts or inject behavior. Each concrete Prototype claims its role through `def.anatomy.claim()`.

## Split ownership by responsibility

A sound compound boundary answers who owns each information path rather than following DOM regions:

- Root owns selected value, controlled/uncontrolled coordination, and context publication.
- List owns collection ordering and roving focus.
- Trigger reads shared context and issues selection requests.
- Content derives current, hidden, and presence behavior from protocol value.
- Indicator consumes context facts without becoming a second selection owner.

Return to modeling if all state remains in Root while Parts are only named visual shells, or if a Part without an independent responsibility becomes a new P identity.

## Context carries shared protocol facts only

`TABS_CONTEXT` currently includes root identity, selected and active value, orientation, activation mode, the controlled fact, and request/validation coordination. It serves family collaboration, not arbitrary transport for:

- host DOM or framework objects;
- private visual tokens;
- page business state; or
- Form, layout, or announcement responsibilities outside Tabs.

Applicable P criteria and tests must constrain context fields and owners; convenience alone is not enough.

## Compound does not mean prototype-level template composition

`K-PROTOTYPE-COMPOSITION-0001` states that core templates describe structure inside one Root Node and do not directly nest another Prototype. Component composition belongs to the host, framework, or compiler layer.

An anatomy family, context coordination, and application-level component composition are therefore different concerns. Do not collapse them into one “compound component syntax.”

## Close implementation and evidence together

Every new or changed role or criterion should form this chain:

```text
P criterion
→ anchored T case
→ owner or part implementation
→ focused family test
→ Adapter and accessibility evidence
→ exports, CLI, docs, demo
```

Typical boundaries include controlled requests, disabled items, empty or duplicate values, structural churn, presence, focus, accessibility relationships, and teardown. The approved issue decides the exact scope.

## Next

- To add a design language over an existing Base family, read [Building a Styled Library on Top of Base](/en/build/prototypes/building-a-styled-library-on-top-of-base/)
- To follow entities and evidence into source, read [How to Read Reference Implementations](/en/build/prototypes/reference-patterns/)
- Before opening a pull request, use the [Prototype Author Checklist](/en/build/prototypes/checklist/)
