# New Proto compiler

The 0.4 compiler starts from independently defined language semantics. The old private implementation and its implementation-shaped tests have been retired; their behavior and artifacts are not compatibility obligations or correctness oracles for this compiler.

## Specification

The catalog is the sole normative source:

- [Decision: the new compiler foundation](../../spec/decisions/D-COMPILER-FOUNDATION-0001.yaml) records the maintainer's accepted direction and alternatives.
- [Compiler and language contract](../../spec/contracts/C-COMPILER-FOUNDATION-0001.yaml) defines the language, execution model and lowering obligations.
- [Independent conformance cases](../../spec/tests/T-COMPILER-FOUNDATION-0001.yaml) give concrete expected traces and record the absent implementations.
- [Shared-source and lint contract](../../spec/contracts/C-COMPILER-LINT-0001.yaml) separates source validity, analysis completeness and target compilability; [its implementation notes](source-compatibility-and-lint.md) explain migration and the complete consumer inventory.
- [Authoring contract](../../spec/contracts/C-COMPILER-AUTHORING-0001.yaml) and [three complete design inputs](authoring-surface.md) select explicit 0.4 APIs without pretending their declarations implement the Adapter or compiler.

These entities are draft because implementation and execution evidence are missing. The accepted direction is settled; draft does not request another round of approval. This page explains how to implement that direction and cannot add another set of language rules.

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

The initial implementation shares one controlled TypeScript Program and checker across analysis, `proto-compiler lint` and a Node editor diagnostic API.

- It records original source bytes, module resolution and configuration, and checks a bounded set of boolean, conversion and text violations.
- The partial result remains `analysisComplete: false` and `sourceValid: false | null`; a quiet report does not admit source.
- Authoring bindings, complete phase/effect/ownership analysis, canonical IR and executable target lowering remain missing. See the [package entry](../../packages/compiler/README.md).

The [consumer intake](consumers/README.md) records exact revisions, source hashes, explicit entrypoints and unresolved inventory. Its verifier reuses that shared frontend closure; matching input bytes does not establish language validity, compilation or behavioral conformance.

| Target         | Sequence            | New implementation and conformance |
| -------------- | ------------------- | ---------------------------------- |
| React          | First complete path | Missing                            |
| GPUI           | First complete path | Missing                            |
| Vue 2          | Required final path | Missing                            |
| Vue 3          | Required final path | Missing                            |
| Web Components | Required final path | Missing                            |

The foundation PR supplies definitions and removes the former implementation; it does not supply a working replacement. Subsequent increments implement coherent language capabilities through actual generated consumers. Unsupported targets or operations remain visible work, not passed cases. An extern's real target boundary is explicit; no platform-specific extern obstacle is currently known for the existing prototype inventory.

Use [the implementation checklist](atomic-lowering-completion.md) to connect work to exact contract criteria, and [application consumers](application-consumers.md) to select meaningful interactions. Collect comparable cost baselines before assigning budgets; source lines, support size, retained output and runtime cost are separate measurements.
