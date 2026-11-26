---
title: 'Compiler Guide'
desp: 'The 0.4 Proto language compiler foundation and implementation status'
description: 'The 0.4 Proto language compiler foundation and implementation status'
---

The old private compiler has been retired. The replacement belongs to **0.4 scope** and now includes an initial shared frontend and partial semantic lint; none of its five source backends is implemented yet. The [compiler foundation](https://github.com/Proto-UI/Proto-UI/blob/main/internal/compiler/README.md) is the implementation entry point.

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

| Source target  | Replacement status | Delivery plan             |
| -------------- | ------------------ | ------------------------- |
| React          | Not implemented    | First implementation pair |
| GPUI           | Not implemented    | First implementation pair |
| Vue 2          | Not implemented    | Required source backend   |
| Vue 3          | Not implemented    | Required source backend   |
| Web Components | Not implemented    | Required source backend   |

Application-specific externs may declare a limited target set and must fail clearly when a binding is missing. This does not waive any of the five backend obligations for the official portable library.

## What this foundation delivers

The repository now records the new contract, independent semantic test scenarios, implementation order and the retirement boundary. The old compiler, generated fixtures, compiler-specific runners and browser compilation panel are removed. Git history retains the old implementation and dated observations; they are not evidence for the replacement.

The private package exposes availability and an initial source-analysis command:

```sh
node packages/compiler/src/cli-entry.mjs --status
node packages/compiler/src/cli-entry.mjs lint path/to/component.proto.ts --target react --json
```

The temporary CLI rejects compilation requests with `PUI_COMPILER_NOT_IMPLEMENTED`; the `requireCompilerImplementation()` availability guard raises the same code. Imports of removed APIs can instead fail at module loading or a consumer's export check. There is no supported replacement compile command yet. The package remains private; this status boundary is not a promised compiler API.

The new lint command shares its TypeScript Program/checker analysis with an editor integration API. It checks implemented boolean, coercion and text rules without executing author modules. Reports bind source/dependency bytes and configuration, and distinguish invalid source, incomplete analysis and unavailable targets. Full phase, effect, ownership and backend analysis remains missing: `analysisComplete` is currently false, an otherwise undiagnosed source remains `sourceValid: null`, and all targets remain non-compilable. Exit status 1 indicates invalid source; 2 indicates incomplete analysis or an unavailable requested target. The command does not rewrite source or generate components.

Each implementation batch must demonstrate its complete scenario through ordinary target builds and observed behavior. Unsupported language features, missing compiler work, missing backend lowering and unbound externs must remain distinguishable. Performance work starts with reproducible cold, warm, incremental, shared and per-component measurements before adopting hard budgets.

For ongoing application work, use the [Runtime architecture](/en/build/runtime-architecture/) and [Adapter guide](/en/build/adapter-guide/). For compiler development, start with the [foundation and work sequence](https://github.com/Proto-UI/Proto-UI/blob/main/internal/compiler/README.md).
