---
title: 'Writing a Compound Prototype'
description: 'Model Anatomy roles, state ownership, Context sharing, and multi-part boundaries for compound Prototypes.'
---

Designing a compound Prototype is about modeling ownership and structural relationships first, then organizing source files around those boundaries—not splitting a large component into files by visual region.

Existing compound families build directly on their `P-*` and `T-*` specs. For a brand-new Base family, start with `draft` entities, candidate anatomy, probes, and tests, then follow [Implementing a Governed Base Semantic Slice](/en/build/prototypes/implementing-an-approved-base-slice/) for full delivery.

## Read the spec graph before splitting parts

`Tabs` is a clear reference family in this repository. Start by inspecting:

- `P-BASE-TABS` and its Root-owned selection criteria;
- `P-BASE-TABS-LIST`, `P-BASE-TABS-TRIGGER`, `P-BASE-TABS-CONTENT`, and `P-BASE-TABS-INDICATOR`;
- the matching `T-BASE-TABS-*` test entities and executable paths;
- [shared.ts](https://github.com/Proto-UI/Proto-UI/blob/main/packages/prototypes/base/src/tabs/shared.ts) and each part's `*.proto.ts`; and
- `packages/prototypes/base/test/tabs.test.ts`.

> Note: These Tabs spec entities are currently `draft`; refer to the spec files for their latest definitions.

## Five roles in Tabs Anatomy

`P-BASE-TABS` defines five cooperating roles:

| Role | Cardinality | Responsibility |
| --- | --- | --- |
| `root` | `1..1` | Owns selected value, provides Context, and anchors the Anatomy domain |
| `list` | `0..1` | Manages trigger ordering and roving focus |
| `trigger` | `0..*` | Requests selection using its own `value` |
| `content` | `0..*` | Controls tabpanel active state, visibility, and mounting by `value` |
| `indicator` | `0..*` | Reads Context for visual positioning without owning selection, focus, or events |

`Anatomy` declares roles, cardinality, and `contains` relations—it does not instantiate child nodes or inject behavior. Each concrete Prototype declares its role during setup with `def.anatomy.claim()`.

## Split ownership by responsibility

A clean compound boundary assigns each data flow to a single owner instead of slicing along DOM wrappers:

- **Root** owns the selected value, controlled/uncontrolled coordination, and Context publication.
- **List** owns collection ordering and keyboard roving focus.
- **Trigger** reads shared Context and sends selection requests.
- **Content** derives `current`, `hidden`, and presence state from the active value.
- **Indicator** consumes shared Context for presentation while keeping Root as the single source of truth.

Revisit the model if a part has no distinct responsibility beyond wrapping styles, or if Root owns everything while parts lack clear protocol boundaries.

## Keep Context focused on shared protocol facts

`TABS_CONTEXT` carries only what parts need to coordinate: root identity, selected/active value, orientation, activation mode, controlled flag, and request/validation state.

Keep Context host-neutral and lean by leaving out:

- host DOM elements or framework-specific objects;
- theme-private visual tokens;
- application or page business state; and
- unrelated form, layout, or announcement concerns.

Constrain Context fields and write ownership through the applicable `P-*` criteria and tests.

## Anatomy families vs. component composition

Per `K-PROTOTYPE-COMPOSITION-0001`, core templates describe structure inside one Root node and do not directly nest another Prototype. Higher-level component composition belongs in the host framework or compiler layer.

Keep these three concerns distinct: **Anatomy families** (structural roles), **Context** (cross-part state sharing), and **application-level composition**.

## Close implementation and tests together

For every new or updated role or criterion, follow the full loop:

```text
P-* criterion
→ Anchored T-* test case
→ Root / Part implementation
→ Focused family tests
→ Adapter and accessibility checks
→ Exports, CLI, docs, and demo
```

Make sure tests cover common edge cases: controlled request handling, disabled items, empty or duplicate values, dynamic insertion/removal, mounting and teardown, keyboard focus, and ARIA relationships.

## Next steps

- Layer a design language onto a Base family: [Building a Styled Library on Top of Base](/en/build/prototypes/building-a-styled-library-on-top-of-base/)
- Navigate reference code from specs: [How to Read Reference Implementations](/en/build/prototypes/reference-patterns/)
- Review before opening a PR: [Prototype Author Checklist](/en/build/prototypes/checklist/)
