# Native DOM support compilation

`plan.ts` maps the target's reached operation graph to host implementation units. Each unit declares its helper imports, native resources, and release obligations. The transitive feature closure determines both the emitted ES module graph and external packages. Component names, source filenames, and unreachable function bodies do not participate in selection.

`dom-interaction.template.ts` and `dom-modules.template.ts` are the canonical host source templates. Their `__nativeFeature` calls are compiler directives, with a closed vocabulary checked by `specialize.ts`. The compiler folds those guards, narrows the public capability surface, and takes a TypeScript-symbol dependency closure over declarations. Lexical shadowing and shorthand properties use the TypeScript checker, rather than source-text searches. No feature evaluator, operation table, AST, or semantic IR is emitted to the consumer.

`artifacts.ts` assembles ordinary ES modules with explicit imports. Capability factories receive only their reached closure. Logical identity must also compose between different closures, so shared registries have stable, separate ABIs:

| Module                  | Shared identity                                         |
| ----------------------- | ------------------------------------------------------- |
| `ownership-v2`          | Logical owners, physical roots, Anatomy parts, host IDs |
| `focus-ownership-v2`    | Active scopes, request arbitration, entry intent        |
| `boundary-ownership-v2` | Boundary stack and per-sample arbitration               |
| `overlay-ownership-v2`  | Modal host locks                                        |
| `hit-ownership-v2`      | Shared physical hit claims                              |
| `table-ownership-v2`    | Table membership/projection records                     |

Only reached registry modules are emitted. Mutable shared counters live in an explicit state record, so separately emitted factories cannot each acquire an independent copy. Plan-specific native/module files use a deterministic plan ID; the generated provenance records its version, ID, and features for exact closure verification and library linking.

`legacy-text-v1.template.ts` and the separate `native-support-legacy.ts` retain historical compatibility bytes. They are not alternative implementations for new compilation. New Text and Image combinations use the canonical templates, which also preserves request-bound image completion, immediate cached-image facts, physical event containment, and cleanup for mixed-capability consumers.

Verification lives in `test/native-support-plan.test.ts` and `test/native-support-capabilities.test.ts`. It checks strict emitted TypeScript for every unit, reached/unreached controls across the four Web emitters, source bytes, production-retained bundles, actual state/listener registration, and view/terminal cleanup. Bundle measurements retain the exported capability factory and include Floating UI when positioning is reached; source size alone is not treated as tree-shaking evidence.
