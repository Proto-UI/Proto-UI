---
title: 'Compiler Guide'
desp: 'The current Compiler boundary: what 0.2 ships, what the catalog constrains, and what remains future work'
description: 'The current Compiler boundary: what 0.2 ships, what the catalog constrains, and what remains future work'
---

Proto UI 0.2 does **not** ship a Compiler implementation or a Compiler authoring workflow. There is no `@proto.ui/compiler` package, compiler entity type, official compiler profile, CLI compile command, or supported compiler input/output artifact in the 0.2 release.

This guide exists to stop future direction from being mistaken for shipped behavior. It records the boundaries a future Compiler would already have to respect and points contributors back to the runtime Adapter path that works today.

## Prerequisites

Read [Translation Layer: Adapter / Compiler](/en/whitepaper/translation-layer/) for the conceptual distinction, [Core](/en/specifications/core/) for portable syntax, and [Runtime Architecture](/en/build/runtime-architecture/) for the current execution path.

## What 0.2 actually ships

| Layer | Current responsibility |
| --- | --- |
| `@proto.ui/core` | Prototype definition, setup/render syntax, template structures, module declarations, Rule authoring types |
| `@proto.ui/runtime` | Materialize a Prototype, run Modules, own lifecycle/update flow, hand commits to a host |
| Official Adapters | Translate Runtime output and semantic host capabilities for Web Component, React, and Vue profiles |
| `@proto.ui/cli` | Initialize projects and generate themes, tokens, styles, and component preset material; it is not a Prototype compiler |

The current production route is therefore:

```text
Prototype TypeScript → Runtime execution → official Adapter → Web host
```

A possible future route is only a design direction:

```text
portable analyzable input → [future Compiler] → host artifacts
```

Nothing in 0.2 promises the second route's accepted source language, optimization model, generated files, runtime footprint, or compatibility policy.

## Constraints that already apply

Even without a Compiler package, cataloged protocol boundaries constrain any future official translation:

- `K-PROTOTYPE-COMPOSITION-0001`: templates describe one Root Node; they do not embed another Prototype definition.
- `C-TEMPLATE-0005`: the v0 slot is anonymous, singular, and parameterless.
- `C-TEMPLATE-0006`: an official Adapter or Compiler encountering `PrototypeRef` as a template node must reject it rather than inventing private composition.
- `C-RULE-0003`: Rule declarations produce serializable `RuleIR` without functions, host references, closures, or live handles.
- `C-MODULE-DECLARATION-0001`: static typed Module declarations are available before Module construction and potential host selection.

These are protocol constraints, not a Compiler SPI. They do not specify a parser, AST format, incremental build graph, code generator, or deployment artifact.

## Static intent versus arbitrary functions

Some authoring forms preserve more analyzable intent than callbacks. Rule is the clearest current example: it separates condition from semantic intent and compiles internally to `RuleIR` for Runtime evaluation. That does **not** mean the repository has a general Prototype compiler, nor that arbitrary callback bodies can be translated losslessly.

Use declarative forms when they accurately express behavior, but do not rewrite working 0.2 semantics around an imagined compiler. `internal/contracts/integration/portability-and-integration.md` discusses this longer-term direction as explanatory, non-normative material.

## No supported Compiler inputs or outputs yet

| Question | 0.2 answer |
| --- | --- |
| Can a `.proto.ts` file be compiled without Runtime? | No supported workflow |
| Is `TemplateChildren` a stable compiler IR? | No; it is current Core/Runtime template data |
| Is `RuleIR` a complete Prototype IR? | No; it covers Rule only |
| Can CLI emit React/Vue/Custom Element components from a Prototype? | No |
| Is zero-runtime delivery supported? | No; it remains future direction |
| Is there a Compiler conformance matrix? | No Compiler entity/profile exists |

If a future proposal needs one of these answers to change, it requires explicit catalog and API work rather than documentation inference.

## Contribution boundary

A Compiler proposal should begin as maintainer-guided research. It must identify at least:

1. the portable source subset and how unsupported constructs fail;
2. the output host and ownership of generated artifacts;
3. semantic parity with existing Contract criteria;
4. lifecycle, capability, and component-composition treatment;
5. a versioned identity and executable conformance model; and
6. migration and coexistence with the Runtime/Adapter path.

Do not open an implementation PR by treating `packages/modules/rule/src/compile.ts`, CLI style generation, or a bundler transform as the missing Compiler architecture. Those are bounded implementations with different owners.

## Verification of the current boundary

The following checks exercise the portable template and analyzable Rule constraints that exist today:

```sh
corepack pnpm@10.32.1 vitest run packages/core/test/contract/template.normalize.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/adapters/web-component/test/contract/template.no-prototype-composition.v0.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/rule.props-style.smoke.v0.contract.test.ts
corepack pnpm@10.32.1 check:types
```

For work that can ship now, continue to [Runtime Architecture](/en/build/runtime-architecture/), [Module & Extension Architecture](/en/build/module-extension-architecture/), or the bounded [Adapter Guide](/en/build/adapter-guide/). For future sequencing, see [Roadmap](/en/project/roadmap/).
