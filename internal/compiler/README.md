# New Proto compiler

The 0.4 compiler starts from independently defined language semantics. The old private implementation and its implementation-shaped tests have been retired; their behavior and artifacts are not compatibility obligations or correctness oracles for this compiler.

## Specification

The catalog is the sole normative source:

- [Decision: the new compiler foundation](../../spec/decisions/D-COMPILER-FOUNDATION-0001.yaml) records the maintainer's accepted direction and alternatives.
- [Compiler and language contract](../../spec/contracts/C-COMPILER-FOUNDATION-0001.yaml) defines the language, execution model and lowering obligations.
- [Independent conformance cases](../../spec/tests/T-COMPILER-FOUNDATION-0001.yaml) define the expected traces for each implementation.
- [Shared-source and lint contract](../../spec/contracts/C-COMPILER-LINT-0001.yaml) separates source validity, analysis completeness and target compilability; [its implementation notes](source-compatibility-and-lint.md) explain migration and the complete consumer inventory.
- [Authoring contract](../../spec/contracts/C-COMPILER-AUTHORING-0001.yaml) and [three complete design inputs](authoring-surface.md) select explicit 0.4 APIs without pretending their declarations implement the Adapter or compiler.

These entities are draft because implementation and execution evidence are incomplete. The accepted direction is settled; draft does not request another round of approval. This page explains how to implement that direction and cannot add another set of language rules.

## Implementation map

| Layer | Work owned here |
| --- | --- |
| TypeScript frontend | Reuse Program, checker, symbols and module resolution; add Proto phase, effect, capture, value-domain and ownership analysis. |
| Component HIR | Preserve component structure, declarations, reactive dependencies, logical Context topology and lifecycle. |
| Behavior IR | Lower typed control flow, captures, local transactions, effects and owned async tasks. |
| Target AST | Generate ordinary components and calls to explicit host primitives using existing target tooling. |
| Shared support | Provide reached transaction, task, resource and host primitives as real modules/crates. Do not execute declarations or compiler IR. |

TypeScript factory/printer facilities serve the JavaScript-family AST paths. Rust emission can use `syn`, `prettyplease` and local typed `quote` construction; whole source files and runtime bodies must not become raw string templates. API spellings and internal data layouts remain implementation choices under the contract. There is no LLVM dependency in the first source-compilation milestone.

## Current delivery state

The analysis API, `proto-compiler lint`, Node editor integration and source producer share the controlled TypeScript Program and checker. General lint records raw source bytes, module resolution and configuration and diagnoses implemented boolean, conversion and text-domain violations. `analysisComplete` remains `false`. `sourceValid` is `false` for a proven violation and `null` otherwise. Complete phase, effect and ownership analysis is still missing.

The frontend reads all three versioned authoring inputs from disk and resolves compiler-owned typed intrinsic declarations. Use `createProtoProgram` from `@proto.ui/compiler/frontend`, then `produceComponentIR(program, { fileName, publicName })` from `@proto.ui/compiler/producer` to select the default source export. On `status: 'produced'`, the result carries `component` and `sourceClosure`. Pass the same component to `emitReact(component)` or `await emitGpui(component)` from the respective `@proto.ui/compiler/targets/react` and `@proto.ui/compiler/targets/gpui` entries. The private CLI exposes this source path as `compile <path> --target react|gpui [--name ...] [--out ...]`. The public Core runtime has yet to export `@proto.ui/core/authoring`, and common-source execution through an Adapter remains unverified. See the [authoring inputs](authoring-surface.md) and [package entry](../../packages/compiler/README.md).

The [consumer intake](consumers/README.md) records exact revisions, source hashes, explicit entrypoints and unresolved inventory. Its verifier reuses that shared frontend closure; matching input bytes does not establish language validity, compilation or behavioral conformance.

| Target         | Evidence for the versioned readonly Badge |
| -------------- | ----------------------------------------- |
| React          | Chromium mounts the generated TypeScript component. It observes DOM text, computed color, nested dot width and public `label` and `tone` values after prop updates. |
| GPUI           | A native headless host mounts the generated Rust component. It observes painted text, chip and nested dot and reads `label` and `tone` as each input changes. |
| Vue 2          | Source backend still missing. |
| Vue 3          | Source backend still missing. |
| Web Components | Source backend still missing. |

The foundation PR supplied definitions and retired the former implementation. Direct IR fixtures exercise the emitters independently of source lowering. The version 3 IR represents optional presence, the `fixed-instance` policy and closed records. In the authored Toggle, `active` has a boolean payload when present, and `activeChange` carries the readonly record `{ active: boolean }`.

React and GPUI consumed the same Toggle source, checked IR and source closure. Four Chromium cases passed, covering trusted clicks, same-key rejection, retained initialization and invalid first input. Three `controlled_source` Rust cases passed, covering pointer requests awaiting owner publication, retained local state and a subscriber queuing owner acceptance. The focused run reported 17 Node tests and 22 tests in its native Rust suite, all passing with no skips. To repeat the checks from the repository root, run the following commands.

```sh
node --test packages/compiler/test/composite-ir.node-test.mjs
node --test packages/compiler/test/controlled-source-react.node-test.mjs
node --test packages/compiler/test/gpui-target.node-test.mjs
```

The Tabs owner still reports `compiler-missing` with capability `logical-context` at its `def.context.provide` call on line 107. It also requires keyed child identity, owned task segments and a real target binding for `authoring.load-tab`. Its panel starts the loader on creation, so completing Context and child identity in M2 covers only part of the source. The full example reaches M3.

Use [the implementation checklist](atomic-lowering-completion.md) to connect work to exact contract criteria, and [application consumers](application-consumers.md) to select meaningful interactions. Collect comparable cost baselines before assigning budgets; source lines, support size, retained output and runtime cost are separate measurements.
