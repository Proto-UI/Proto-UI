---
title: 'Compiler Guide'
desp: 'The 0.4 Proto language compiler foundation and implementation status'
description: 'The 0.4 Proto language compiler foundation and implementation status'
---

The old private compiler has been retired. Its **0.4** replacement compiles the versioned readonly Badge and controlled Toggle into TypeScript React components and native Rust GPUI components. Both targets consume the same checked component IR from the shared TypeScript Program. The [compiler foundation](https://github.com/Proto-UI/Proto-UI/blob/main/internal/compiler/README.md) is the implementation entry point.

Existing applications continue to use [Runtime](/en/build/runtime-architecture/) and [Adapters](/en/build/adapter-guide/). Their working examples, component facades and style tooling remain supported within their own release boundaries. The compiler rebuild does not add an acceptance condition to the 0.3 release.

## Existing compiler consumers

The retirement change is based on [`67fd94f58372cf35fa929f24ef731416b5817e31`](https://github.com/Proto-UI/Proto-UI/tree/67fd94f58372cf35fa929f24ef731416b5817e31), the revision immediately before this change. Applications that build with the old private compiler should retain an already-validated earlier pin until they migrate. This baseline identifies the retirement boundary; it does not certify an application's build at that revision.

Moving a dependency pin across this boundary removes old exports such as `compileFile`, `writeCompilation` and `formatCompilerDiagnostics`. Existing imports or consumer export checks can fail before any compiler function is called. The replacement does not preserve those APIs.

An application can explicitly migrate its affected components to the existing Runtime/Adapter path and validate them against that path's versioned contracts, or wait for the required new compiler capability. This is a consumer migration choice. The compiler does not automatically fall back to an Adapter or reinterpret old sources as the new language.

## Source of truth

The new compiler has no compatibility obligation to the retired parser, APIs, generated output or tests. Its behavior is defined by the spec catalog:

- [C-COMPILER-FOUNDATION-0001](https://github.com/Proto-UI/Proto-UI/blob/main/spec/contracts/C-COMPILER-FOUNDATION-0001.yaml): language and execution contract.
- [D-COMPILER-FOUNDATION-0001](https://github.com/Proto-UI/Proto-UI/blob/main/spec/decisions/D-COMPILER-FOUNDATION-0001.yaml): architecture and engineering decisions.
- [T-COMPILER-FOUNDATION-0001](https://github.com/Proto-UI/Proto-UI/blob/main/spec/tests/T-COMPILER-FOUNDATION-0001.yaml): required observations and missing implementation evidence.

These entities describe the intended compiler. Their draft lifecycle reflects unfinished implementation and validation; it does not turn old compiler behavior into a default.

## Authoring and execution

Proto uses legal TypeScript syntax and TypeScript compiler infrastructure, with its own portable value, phase, ownership and effect rules. A TypeScript type check alone does not establish Proto validity. Schema, initialization, reactive derivation, actions and lifecycle have explicit roles. Existing `.proto.ts` sources will migrate through a planned 0.4 work item, rather than being silently reinterpreted.

Dependencies are determined statically. When exact dependencies cannot be proven, the compiler may conservatively widen the dependency set for a pure derivation; an unmodelable program receives a diagnostic. Broader dependency sets must not duplicate effects.

Within an action, reads observe that action's writes, including derived values. A synchronous segment publishes its state at the action boundary. Each `await` ends a segment; resumption starts another. Failure discards only the current unpublished writes and unexecuted queued effects. Already committed state and completed external effects are not rolled back.

Async tasks have owners, cancellation and stale-result rules. Context values and provider identity are reactive. Only explicitly exposed actions and state become host APIs; typed, read-only state projections let the host compose appearance.

## Compilation architecture

The compiler must analyze authored behavior and lower it through typed semantic IR into structured target ASTs. It reuses mature parsing, type checking and printing infrastructure. React and GPUI are the first source backends; LLVM is not a prerequisite.

Generated components must integrate with ordinary host applications. Executing the original prototype, embedding a dynamic JavaScript VM, interpreting Proto IR at runtime, or wrapping the existing Runtime/Adapter is not a successful compilation fallback. Component names and source paths must not select bespoke lowering behavior.

| Source target  | Evidence from authored source |
| -------------- | ----------------------------- |
| React          | Chromium observed the Badge's DOM text, computed color, nested dot width and readonly projections. Four Toggle cases exercised trusted clicks, fixed-mode input rejection, retained local state and invalid initial input. |
| GPUI           | A native headless host observed the Badge's painted label, chip, nested dot and readonly projections. Three Toggle cases exercised pointer requests, local state across reattachment and queued acceptance by a signal subscriber. |
| Vue 2          | Source backend still missing. |
| Vue 3          | Source backend still missing. |
| Web Components | Source backend still missing. |

Both Badge hosts observed the online appearance and the common chip appearance for an unknown tone. Separate fixtures start directly from checked IR to exercise target behavior independently of the authoring frontend.

Application-specific externs may declare a limited target set and must fail clearly when a binding is missing. This does not waive any of the five backend obligations for the official portable library.

## What this foundation delivers

The repository now records the new contract, independent semantic test scenarios, implementation order and the retirement boundary. The old compiler, generated fixtures, compiler-specific runners and browser compilation panel are removed. Git history retains the old implementation and dated observations; they are not evidence for the replacement.

The private package accepts `compile <path> --target react|gpui [--name ...] [--out ...]`. By default, `compile` finds the nearest `tsconfig.json` starting at the input file's directory. For both examples below, `internal/compiler/examples/tsconfig.json` maps the authoring import to the compiler's typed declarations. Use `--project <path>` to select a project explicitly. The `lint` command starts its default project search in the working directory.

```sh
node packages/compiler/src/cli-entry.mjs --status
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/readonly-badge.proto.ts.txt --target react --name AuthoringBadge --out AuthoringBadge.ts
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/readonly-badge.proto.ts.txt --target gpui --name AuthoringBadge --out authoring_badge.rs
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/controlled-toggle.proto.ts.txt --target react --name ControlledToggle --out ControlledToggle.ts
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/controlled-toggle.proto.ts.txt --target gpui --name ControlledToggle --out controlled_toggle.rs
```

The frontend reads all three versioned authoring examples from disk. Compiler-owned typed intrinsic declarations resolve the authoring operations. The public Core runtime has yet to export `@proto.ui/core/authoring`. Adapter execution and migration of a consumer to common source remain unverified.

With `active: false`, two enabled presses each requested `{ active: true }` while the button stayed `Off`. When the host published `active: true`, the public value became `true` and the button displayed `On`. Omitting `active` selected local ownership and initialized it once from `defaultActive`. Disabled input produced no request. A same-instance change in the presence of `active` was rejected as a whole, and a new instance could select a different mode. Both hosts ran components generated from the same Toggle source and checked IR.

General lint and the editor use the shared TypeScript Program and checker to check implemented boolean, coercion and text rules without executing author modules. To analyze a component in your project, run `node packages/compiler/src/cli-entry.mjs lint path/to/component.proto.ts --target react --json`. Reports bind source and dependency bytes and configuration. `analysisComplete` remains `false`. `sourceValid` is `false` for a proven violation and `null` otherwise. Lint exits with status `1` for invalid source or `2` for incomplete analysis or an unavailable target. The Tabs source still needs a keyed child, a logical Context provider and consumer, and an owned task with a real loader binding.

Each implementation batch must demonstrate its complete scenario through ordinary target builds and observed behavior. Unsupported language features, missing compiler work, missing backend lowering and unbound externs must remain distinguishable. Performance work starts with reproducible cold, warm, incremental, shared and per-component measurements before adopting hard budgets.

For ongoing application work, use the [Runtime architecture](/en/build/runtime-architecture/) and [Adapter guide](/en/build/adapter-guide/). For compiler development, start with the [foundation and work sequence](https://github.com/Proto-UI/Proto-UI/blob/main/internal/compiler/README.md).
