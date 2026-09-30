---
title: 'Compiler Guide'
desp: 'The 0.2 release boundary and the separately verified private compiler experiment'
description: 'The 0.2 release boundary and the separately verified private compiler experiment'
---

Proto UI 0.2 does **not** ship a Compiler implementation or a Compiler authoring workflow. There is no `@proto.ui/compiler` package, compiler entity type, official compiler profile, CLI compile command, or supported compiler input/output artifact in the 0.2 release.

Release support and repository experiments are separate. The private experiment described below does not change the 0.2 package, catalog, CLI, or official-support boundary.

## Prerequisites

Read [Chapter 5: Translation Layer](/en/whitepaper/5-translation-layer/) for the conceptual distinction, [Core](/en/specifications/core/) for portable syntax, and [Runtime Architecture](/en/build/runtime-architecture/) for the current execution path.

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

A Compiler route was not shipped in 0.2:

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

## No supported Compiler inputs or outputs in 0.2

| Question | 0.2 answer |
| --- | --- |
| Can a `.proto.ts` file be compiled without Runtime? | No supported workflow |
| Is `TemplateChildren` a stable compiler IR? | No; it is current Core/Runtime template data |
| Is `RuleIR` a complete Prototype IR? | No; it covers Rule only |
| Can CLI emit React/Vue/Custom Element components from a Prototype? | No |
| Is zero-runtime delivery supported? | No; it remains future direction |
| Is there a Compiler conformance matrix? | No Compiler entity/profile exists |

If a future proposal needs one of these answers to change, it requires explicit catalog and API work rather than documentation inference.

## Private repository compiler experiment

`packages/compiler` is an implemented **private experiment**, not an official Compiler distribution. Its manifest retains `private: true` and `protoUi.release.scan: false`. The private compiler CLI is separate from the published `proto-ui` CLI; publication, catalog admission and maintained compatibility require their own approval.

### Implemented profiles and compatibility

| Private profile | Exercised target | Output dependency boundary |
| --- | --- | --- |
| `react-runtime-v1` | React / React DOM 19.2.6 | Retains Proto UI Core, Hooks and React Adapter; not Runtime-independent |
| `react-dom-source-v1` | React / React DOM 19.2.6 | Target framework plus emitted native helpers; no Proto UI Runtime/Adapter |
| `vue-source-v1` | Vue 3.5.31 | Target framework plus emitted native helpers; no Proto UI Runtime/Adapter |
| `vue2-source-v1` | Vue 2.6.14 | Target framework plus emitted native helpers; no Proto UI Runtime/Adapter |
| `web-component-source-v1` | Custom Elements v1 | Emitted native helpers; no framework or Proto UI Runtime/Adapter dependency |

GPUI, Qt and Flutter profile identities are **unimplemented** and reject compilation. A profile's concrete tested target version is not a compatibility promise for other versions. Restricted source admission, semantic IR version **4**, target profile identity and emitted helper ABI **1** are separate private compatibility dimensions; neither IR nor helper files are a public plugin SPI.

The frontend reads a closed, root-contained TypeScript source graph without importing or evaluating the author program. It admits checked data, primitive/control-flow callbacks, static helpers and authored hooks, explicit updates, named State and typed exposes, Props and Context reads/watchers, one-Root templates, serializable Rule conditions and style intent, and the declared native event/focus/accessibility slice. Unsupported syntax, phase/capture authority, operations, target versions and missing host capabilities are diagnostics, not silent bridges.

Native templates keep child style separate from Root feedback and support the singular anonymous slot. Arbitrary attributes, `PrototypeRef`, multiple/named slots, native interaction groups/portals and operations outside the admitted interaction vocabulary remain unsupported. Raw host events are opaque; raw Props snapshots are available, but arbitrary raw-member access is not treated as typed portable data. The setup style `unUse` and Rule declaration disposer stay setup-only; runtime changes use Rules and `run.feedback.style.patch/suppress/clearPatch`.

State writes and feedback projection do not themselves request a template render. Explicit authored update intent remains separate from host policy: React/Vue 3 consumers exercise authored updates; the default Vue 2 props policy and Custom Element `setProps` can explicitly request semantic updates. View detach retains instance state, exposed handles, Context and pending intent; terminal disposal closes them. Framework wrappers compose components through their native ownership mechanisms, not Prototype nodes inside templates.

### Local commands and consumer ownership

Run from the repository root with its development dependencies installed. Choose a fresh output directory:

```sh
node --import tsx packages/compiler/src/cli-entry.ts check packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1
node --import tsx packages/compiler/src/cli-entry.ts compile packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1 --output .cache/compiler-guide-button
node --import tsx packages/compiler/src/cli-entry.ts diff packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1 --output .cache/compiler-guide-button --json
node --import tsx packages/compiler/src/cli-entry.ts watch packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1 --output .cache/compiler-guide-watch --json
```

`inspect` prints checked IR; `explain` reports the profile, requirements and dependencies. `--config` explicitly selects JSON with `entry`, `root`, `export`, `output`, `profile` and `json`; configuration paths are relative to that file, command-line paths to the working directory. Command-line values override configuration, and unknown/repeated flags or fields fail.

Compilation plans source, supporting helpers, standard source maps and hash/provenance manifests before create-only publication. Existing consumer files are never overwritten. `diff` is read-only and identifies consumer modifications against recorded hashes. `watch` publishes immutable `<output>/<session UUID>/revision-<N>` generations, retaining the last successful generation on rejected input; it does not maintain a mutable latest pointer. Consumer edits require a normal target rebuild. The original compiler map remains historical and can be stale after an edit; a rebuild supplies the current executable-to-edited-source map.

### Executed evidence and measured costs

The private verification runs compile and mount three-component/Context assemblies in physically isolated consumers for all four native profiles, type-check generated TypeScript and helpers, rebuild and execute a consumer-owned template edit, reject an introduced syntax error, and verify the physical dependency tree and artifact hashes. Vue 2 JavaScript component bodies are not `checkJs`-validated. A separate offline private-package rehearsal executes the bundled compiler JavaScript API in plain Node and records tarball integrity, bundled compile-time inputs, dependencies, BOM and licenses; this is not an official package or public declaration-file release.

Real Chromium evidence independently checks the original React Adapter, runtime-backed output and native React output for explicit update/detach/reattach contracts and a finite Rule/style/AX/input program. Missing-update and duplicate-activation mutants fail those observations. Separate real failing generated callback stacks resolve through standard executable-to-generated and generated-to-author maps; automatic map composition is not claimed.

Replay the isolated native consumer measurement with:

```sh
node --import tsx scripts/compiler/native-consumer-smoke.mjs
```

Each run retains `summary.json`, `timing.json`, `costs.json`, runtime traces, diagnostics and dependency integrity in its printed evidence directory. Measurements cover cold/hot/changed compilation, whole-process peak RSS and coarse memory snapshots, emitted/supporting source and dependency payload bytes, real framework initialization/update/teardown, retained handle identity and observed instance/view-epoch/Root counts. They do **not** measure exact allocation counts, garbage collection, native-browser layout latency or Adapter-relative speed. Happy DOM consumers are one-sided evidence; the finite Chromium program is not general equivalence, SSR/hydration support or a claim that compiled output is universally faster or smaller.

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
