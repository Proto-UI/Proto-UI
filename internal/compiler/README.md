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

The frontend reads all three versioned authoring inputs from disk. For the readonly Badge it resolves compiler-owned typed intrinsic declarations and lowers the reached helper, props, derivation, public projections and view to checked component IR. The private CLI accepts `compile <path> --target react|gpui [--name ...] [--out ...]`. Both emitters consume the same IR and source closure. The public Core runtime has yet to export `@proto.ui/core/authoring`, and common-source execution through an Adapter remains unverified. See the [authoring inputs](authoring-surface.md) and [package entry](../../packages/compiler/README.md).

The [consumer intake](consumers/README.md) records exact revisions, source hashes, explicit entrypoints and unresolved inventory. Its verifier reuses that shared frontend closure; matching input bytes does not establish language validity, compilation or behavioral conformance.

| Target         | Evidence for the versioned readonly Badge |
| -------------- | ----------------------------------------- |
| React          | Chromium mounts the generated TypeScript component. It observes DOM text, computed color, nested dot width and public `label` and `tone` values after prop updates. |
| GPUI           | A native headless host mounts the generated Rust component. It observes painted text, chip and nested dot and reads `label` and `tone` as each input changes. |
| Vue 2          | Source backend still missing. |
| Vue 3          | Source backend still missing. |
| Web Components | Source backend still missing. |

The foundation PR supplied definitions and retired the former implementation. The other backend cases start at checked IR and exercise the emitters and host behavior independently. Source lowering still lacks other primitives, including the optional prop and typed event payload used by Toggle and the composition of Context, extern bindings and owned tasks used by Tabs. Each requires its own source-to-consumer evidence. An extern's real target boundary is explicit; no platform-specific extern obstacle is currently known for the existing prototype inventory.

Use [the implementation checklist](atomic-lowering-completion.md) to connect work to exact contract criteria, and [application consumers](application-consumers.md) to select meaningful interactions. Collect comparable cost baselines before assigning budgets; source lines, support size, retained output and runtime cost are separate measurements.
