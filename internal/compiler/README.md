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

## Scope & Limits: current delivery

The analysis API, `proto-compiler lint`, Node editor integration and source producer share the controlled TypeScript Program and checker. General lint records raw source bytes, module resolution and configuration and diagnoses implemented boolean, conversion and text-domain violations. `analysisComplete` remains `false`. `sourceValid` is `false` for a proven violation and `null` otherwise. Complete phase, effect and ownership analysis is still missing.

The frontend reads all three versioned authoring inputs and resolves compiler-owned typed intrinsic declarations.

1. Create the Program with `createProtoProgram` from `@proto.ui/compiler/frontend`.
2. Select the default export with `produceComponentIR(program, { fileName, publicName })` from `@proto.ui/compiler/producer`. A produced result carries `component` and `sourceClosure`.
3. Pass that component to `emitReact(component)` from `@proto.ui/compiler/targets/react` or `await emitGpui(component)` from `@proto.ui/compiler/targets/gpui`.

The CLI provides `compile <path> --target react|gpui [--name ...] [--out ...]`. Public Core still lacks the authoring runtime export; common-source Adapter execution remains unverified. See the [authoring inputs](authoring-surface.md) and [package entry](../../packages/compiler/README.md).

The [consumer intake](consumers/README.md) records exact revisions, source hashes, explicit entrypoints and unresolved inventory. Its verifier reuses that shared frontend closure; matching input bytes does not establish language validity, compilation or behavioral conformance.

| Target         | Evidence for the versioned readonly Badge |
| -------------- | ----------------------------------------- |
| React          | Chromium mounts the generated TypeScript component. It observes DOM text, computed color, nested dot width and public `label` and `tone` values after prop updates. |
| GPUI           | A native headless host mounts the generated Rust component. It observes painted text, chip and nested dot and reads `label` and `tone` as each input changes. |
| Vue 2          | Source backend still missing. |
| Vue 3          | Source backend still missing. |
| Web Components | Source backend still missing. |

The foundation PR supplied definitions and retired the former implementation. Direct IR fixtures exercise the emitters independently of source lowering. The version 3 IR represents optional presence, the `fixed-instance` policy and closed records. In the authored Toggle, `active` has a boolean payload when present, and `activeChange` carries the readonly record `{ active: boolean }`.

React and GPUI consumed the same Toggle source, checked IR and source closure.

- Four Chromium cases covered trusted clicks, same-key rejection, retained initialization and invalid first input.
- Three native controlled-source cases covered pointer requests awaiting owner publication, retained local state and queued owner acceptance.
- The focused run passed 17 Node and 22 native tests with no skips. Repeat its checks from the repository root:

```sh
node --test packages/compiler/test/composite-ir.node-test.mjs
node --test packages/compiler/test/controlled-source-react.node-test.mjs
node --test packages/compiler/test/gpui-target.node-test.mjs
```

The version 4 unit links actual child definitions and nominal keys reached from the selected export. `LevelOwner` provides a reactive value to keyed `LevelReader`; both hosts consume the same source and checked IR.

Independent cases cover provider updates, equal-valued provider replacement, same-label key rejection and retained initialization across a React portal or GPUI physical detachment. Run the [Context suite](../../packages/compiler/test/context-source-react.node-test.mjs) and GPUI module above. [Authored fixture](../../packages/compiler/test/fixtures/authoring-context/owner.proto.ts.txt)

The version 5 unit preserves tagged state/result payloads, exact text literals, typed match/await edges, creation actions and owned tasks. Both the default Tabs owner and named `AsyncTabPanel` compile through it.

- Each target binds `authoring.load-tab` to an application function: Chromium uses loopback HTTP and Rust reads local documents.
- Both observe loading before completion, the original request and fresh Context after suspension, business error, supersession, cancellation and panel-retirement withdrawal.
- Source inventory, common-source Adapter execution and the remaining three targets retain separate acceptance criteria.

Source cases: [React](../../packages/compiler/test/tabs-source-react.node-test.mjs) and [GPUI](../../packages/compiler/test/consumers/gpui/tests/tabs_source/mod.rs).

Use [the implementation checklist](atomic-lowering-completion.md) to connect work to exact contract criteria, and [application consumers](application-consumers.md) to select meaningful interactions. Collect comparable cost baselines before assigning budgets; source lines, support size, retained output and runtime cost are separate measurements.
