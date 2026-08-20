---
title: 'Contracts & Tests'
desp: 'How Proto UI connects normative criteria to executable evidence across layers'
description: 'How Proto UI connects normative criteria to executable evidence across layers'
---

Proto UI tests are not one undifferentiated gate. A useful contribution proves the claim at the layer that owns it and records how that evidence connects to the catalog. A green Adapter test cannot silently amend a Contract, and a Runtime fake host cannot prove browser behavior.

## Prerequisites and authority

Read [How to Read Specs](/en/specifications/introduction/) and the repository `spec/README.md` before changing normative behavior. The authority order is:

```text
applicable spec entity
→ internal contract only for an uncataloged gap or explanation
→ relevant dated record for short-term context
→ implementation and tests as evidence
→ website/README as reader projection
```

The former `internal/contracts/**` layer remains useful, but must be labeled transitional when no entity catalogs the subject. It cannot override an applicable entity.

## The evidence graph

`T-*` entities make acceptance criteria executable and traceable:

```text
C-* criterion / D-* choice / P-* protocol
                 │ covers + verifies
                 ▼
              T-* case
                 │ consumesCases
                 ▼
fixture / type test / module test / runtime test / adapter test / journey
```

A `T-*` entity records cases, expected outcomes, implementation paths, required status, and typed relations. The path is evidence; the relation explains what that evidence proves. Tests may also `exercise` a surface without claiming full normative verification.

For example, `T-LIFECYCLE-0003` maps epoch-aware lifecycle criteria to Runtime session/checkpoint tests and lifecycle-event tests for Web Component, React, and Vue. The Runtime fixtures prove ordering and stale-epoch rejection; Adapter fixtures prove each framework projects the structured trace.

## Test layers

| Layer | Typical location | What it can prove |
| --- | --- | --- |
| Shared spec fixture | `packages/spec/fixtures/**` | Reusable case data and criterion mapping |
| Schema/graph | `packages/spec/{schema,engine,graph}/test/**` | Entity validity, relation types, graph projection |
| Type contract | `internal/contracts/types/**` | Public TypeScript shape and inference |
| Core contract | `packages/core/test/contract/**` | Portable definition/template/token syntax |
| Module contract | `packages/modules/*/test/**` | Semantic Module behavior with controlled dependencies/caps |
| Runtime contract | `packages/runtime/test/contract/**` | Phase guards, lifecycle, orchestration, fake-host handoff |
| Adapter contract | `packages/adapters/*/test/**` | Framework/DOM translation, lifecycle ownership, target wiring |
| Prototype test | `packages/prototypes/*/test/**` | Official Prototype protocol and integration behavior |
| Web journey | `packages/web-conformance/test/**` | One scenario across all official Web Adapters |
| Public docs/build | `apps/www` checks and browser audit | Reachability, rendering, examples, reader projection |

Use the lowest layer that observes the rule directly, then add integration evidence only where the claim crosses a boundary. Duplicating the same assertion in every Adapter is not a substitute for one shared Contract fixture plus focused translation checks.

## Choosing coverage for a change

### Contract or Core syntax

Update the applicable `C-*` criteria, a `T-*` mapping, a shared fixture when useful, Core/Runtime implementation, and executable tests. A semantic revision may also require a versioned `revisions` entry.

### Module or Host Capability

Trace `C-* → M-* → HC-* → T-*`. Prove host-neutral semantics in the Module or Runtime with a fake capability, then prove real host realization in each applicable Adapter profile. Do not add an `A-* provides` relation based only on a package dependency.

### Adapter translation

Start from the exact `A-*` profile and reviewed `supports`, `omits`, and `provides` relations. Preserve the portable Contract and add profile-specific evidence. If the Module is absent from both support and omission, record that it is uncataloged rather than inventing matrix status in a test name.

### Prototype behavior

Trace `P-*` criteria to `T-*`, implementation, public exports, and website preview. Compound protocols often need Base tests plus applicable Adapter or browser journeys.

### Documentation only

Validate every named entity/path, run the website check/build, and inspect both locales. Documentation can reveal drift, but should not change an entity merely to match prose.

## Contribution workflow

1. Search by entity ID, criterion ID, relation, and source path—not only filename.
2. Read lifecycle status and version bounds before treating a statement as stable.
3. Reproduce the gap with the smallest owning-layer test.
4. Update source of truth, implementation, executable evidence, and public projections together when scope permits.
5. Run focused tests first; inspect failure text for criterion and owner clarity.
6. Run proportional catalog, type, docs, and full checks.
7. In the PR, list exact commands and distinguish newly run evidence from status copied out of a `T-*` entity.

The generated Agent project understanding explicitly warns that a `passing` status in an entity is recorded metadata—it does not mean generation reran the test.

## Focused and full commands

```sh
# One implementation or contract slice
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/lifecycle.session.v1.contract.test.ts

# Shared official-Web journeys
corepack pnpm@10.32.1 test:web-conformance

# Catalog and generated project understanding
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 spec:docs:agent
corepack pnpm@10.32.1 check:agent-doc

# Public types/docs, then the full repository gate
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
```

Use Node.js 22 and the repository-pinned pnpm 10.32.1 through Corepack. `test` also runs release-version/assets checks, generated style/preset checks, type contracts, and the Vitest suite; it is broader than a single semantic slice.

## Common evidence mistakes

- A snapshot of current output proves behavior only at the captured layer; it does not define semantics.
- Test filenames containing “contract” are not automatically tied to a `C-*`; inspect the `T-*` relation.
- A fake host cannot prove real Adapter timing or browser APIs.
- One Web framework passing does not prove cross-Adapter parity.
- Deleting an old failing case to match new behavior rewrites history; revise entities and migration deliberately.
- Editing generated projections by hand creates drift; change the entity or generator.
- Running only the full suite makes ownership failures harder to diagnose; keep focused commands in the PR.

Continue to [Runtime Architecture](/en/build/runtime-architecture/), [Module & Extension Architecture](/en/build/module-extension-architecture/), or [How to Contribute](/en/build/contribute/) for the delivery workflow.
