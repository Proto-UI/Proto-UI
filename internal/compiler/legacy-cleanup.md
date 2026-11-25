# Compiler legacy cleanup and remaining acceptance

This ledger records the current #1809 compiler cleanup. It accompanies the [v2 compilation specification](v2-compilation-spec.md), [draft pipeline test entity](../../spec/tests/T-COMPILER-PIPELINE-0001.yaml), and [maintained compiler tool guide](../../scripts/compiler/README.md). The old compiler execution code is available in Git history, including the pre-cleanup `59c18246275c9a5ed0ad313c6da2627956930597` tree. Current entry points use the semantic compiler API; none reconstructs the old compiler to make an acceptance run pass.

Deleting a retired wrapper, source template, or stale API call does not discharge its product obligations. This ledger separates migrated executable assertions from work that still needs implementation and new evidence. Original historical reports and receipts are not rewritten.

## Maintained boundary

TypeScript binding and types feed explicit Proto semantic HIR. Target admission precedes native AST construction. React uses `ts.factory` and `Printer`; GPUI uses native `syn` nodes and `prettyplease`; LLVM uses C++ `IRBuilder` and LLVM's standard module printer. Unsupported authored behavior must survive analysis as a located diagnostic. A successful result must not omit an operation or delegate it to an original prototype, adapter, or Proto interpreter.

The compiler-owned registry lists `react` and `gpui` as component targets and `kernel`/`ir` as separate compilation modes. Inventories retain retired profile identities as non-executable obligation rows. A native target receiving a new name does not inherit the old profile's execution receipts.

The legitimate WASM host implementation is retained byte-for-byte as `packages/compiler/src/kernel-host.ts`, published under `@proto.ui/compiler/kernel-host`. It instantiates explicitly compiled modules, checks ABI metadata, owns bounded scalar memory views, and enforces memory/heap/access bounds. The ambiguous `./runtime` export is removed. This host does not interpret Proto, render components, or execute adapters. Four existing kernel tests follow the new import path; their assertions remain intact. Historical receipt paths and hashes keep their original meaning.

## Removed execution paths and replacement ownership

| Removed path under `scripts/compiler/` | Why it is removed | Preserved assertions or replacement |
| --- | --- | --- |
| `generate-web-host-sources.mjs` | Serialized canonical runtime/adapter source into a deleted compiler payload. | Current native output has a target dependency allowlist and an independent consumer. Canonical runtime/adapter behavior remains owned and tested in its product packages. |
| `generate-shader-host.mjs` | Generated a string-source host payload for the retired compiler. | Shader/host integration has no newly demonstrated compiler lowering; retain it as missing target/host acceptance. |
| `packed-generated-smoke.mjs` | Executed the removed artifact/profile/provenance API and runtime source assembly. | Strict target build, dependency closure, ordinary consumer edits, event/props/state/style checks move to `native-consumer-smoke.mjs` and installed-package checks. Full Adapter/generated parity, physical interaction and all target obligations remain missing. |
| `release-family-smoke.mjs` and `release-family-runtime.mjs` | Coupled complete family tests to the removed private compiler API and executable runtime carrier. | Base/Shadcn/Brutalist component semantics, context/expose/lifecycle, native-child mixing and source ownership remain required below. Narrow current tests do not stand in for the full families. |
| `release-family-costs.mjs` and `release-family-cost-runtime.mjs` | Invoked the same removed compiler/runtime carrier for package and browser cost arms. | Preserve total transitive dependencies, retained production bundle, initialization, and three-arm comparison methodology as missing current measurements; keep historical cost reports unchanged. |
| `shenko-consumer-smoke.mjs` | Called deleted parser/profile/build-identity interfaces and a historical consumer fixture. | `consumer-project-inventory.mjs` reads the real checkout with the installed current package and binds unchanged input bytes. A real Shenko application build and browser behavior still require separate acceptance. |
| `sprint2-consumer-inventory.mjs` | Imported the deleted compile/provenance interfaces. | Generic source-bound inventory consumes the current installed API for a caller-selected real checkout; explicit diagnostic and denominator rules remain. |
| `collect-conformance.mjs` | Aggregated a deleted private Button conformance schema/runner. | Preserve complete Button role, disabled activation, focus/keyboard, child and lifecycle behavior as missing current target-native conformance. No empty replacement report claims it passes. |

The separate `scripts/analysis/invisible-consumption/produce-button.mjs` execution entry is also removed. It imported the retired writer/provenance/consumer-closure APIs. The #750 study protocol, collector, source-edit/clock/production observation controls, original artifacts and measured records remain intact. Its maintained README now states that new artifact production is blocked until a full unchanged native Base Button and a current producer exist. Independent clean build, transitive closure, injected internal-import/missing-support rejection, maps, production behavior and independent artifact admission remain required; the replacement is not a same-named tool that always returns a refusal.

The existing `native-consumer-smoke.mjs` and `pinned-cli-smoke.mjs` names now consume the current API and v3 package metadata. They no longer expose compatibility implementations of `TARGET_PROFILES`, `FileSourceGraph`, `compilationArtifacts`, `compilerBuildIdentity`, `parsePrototype`, or the old output/provenance shape. Wrapper byte identity and removed private protocol assertions are retired with that architecture; semantically independent assertions are retained as tests or explicit obligations.

## Migrated admission and source controls

| Area | Current executable control | Interpretation |
| --- | --- | --- |
| Complete library denominator | `library-profile-inventory.mjs`, its tests, and `scripts/ci/compiler-library-inventory.mjs` | Preserve every authored entry/profile row, duplicate/missing/unfinished workers, resume/shard identity, timeout/compiler failures, source drift and earlier PASS regressions. Hook-only `ANALYZED` rows have no emitted artifact. |
| Target identity | `current-api.mjs` and its tests | The compiler owns current component names. Retired targets are explicit obligations, cannot run an old emitter and cannot be aliased to a current target. |
| Frontend source closure | Current TypeScript `Program` source/type hashes, before/after byte verification and local import controls | Reading source does not execute author modules. An out-of-root/unresolved source closure remains explicit. |
| Website discovery | `website-demo-inventory.mjs` and its unchanged twelve discovery/control tests | Preserve migration source registration and the immutable #829 snapshot. Current React Node admission is separate from original WC obligations and actual browser execution. |
| Object-rest controls | `verify-object-rest-controls.mjs` and its existing test | Preserve ordinary TypeScript expected behavior and frozen-source identity; record current compiler HIR analysis separately from native execution. |
| Real consumer identity | `consumer-project-inventory.mjs` | Bind installed package files, consumer HEAD/worktree, selected source files, and all frontend-loaded sources; do not mutate the consumer or imply its application migrated. |
| GPUI source audit | `scripts/gpui/audit-source-lowering.mjs` | Bind current HIR, diagnostics, native output bytes and implementation/source inputs. Present HIR kinds are not old operation certificates or proof of native execution. |
| Cargo graph source identity | `scripts/gpui/check-cargo-graph.mjs` and its graph/source-migration controls | Keep locked Cargo graph, source/version/alias/duplicate/platform/SDK checks for their stated consumer scope. Require explicit Git/revision or registry/version; no deleted compiler profile/dependency module supplies a hidden source. |

The Hook closeout container now invokes the current CLI for GPUI. Its original Web Component condition remains a failed, explicit unimplemented-target phase; it cannot be replaced by React or silently dropped. The complete closeout still needs its own new container/consumer evidence.

The Sprint 1 selector retains its original compiler suites, including those whose new implementations are still missing. Its existing `assertVitestReport` checks the exact executed suite set and every selected assertion, so absent files cannot be silently ignored into a pass. This cleanup does not shrink that selection or relabel its missing results.

Classification is fail-closed: only explicit target-unsupported diagnostics qualify as `UNSUPPORTED`. Type/source/I/O errors and compiler/builder failures remain failures; a mixed unsupported/error result cannot be relabeled as a capability gap. Inventories always report actual native artifact and execution counts separately. Historical profile rows stay in the report even when no current backend implements them.

## Independent current consumers

The current React consumer runner checks the artifact through a strict TypeScript program, copies actual React dependencies into a separate consumer, and executes its emitted module with ordinary React. Its authored fixture preserves the semantic distinction between state writes and update requests: a native click writes state while leaving the template unchanged; a later keyboard callback explicitly requests publication. Props-watch behavior, created-before-first-render, previous-valid/default handling, style composition, instance isolation, native listener cleanup, source editability and an ordinary native sibling are explicit assertions. Failure is retained in a raw receipt; these are not counted as passed merely because the runner was migrated.

The CLI runner executes real competing Node processes and asserts collision protection, preserved manual edits, explicit overwrite, directory and file symlink rejection, and exactly one successful non-overwrite writer. The historical `watch` and `diff` command names produce an explicit unsupported-command result. That refusal does not implement their former workflows.

The pinned package smoke uses separate UI and pure-kernel fixtures. The UI requests an update explicitly. The kernel fixture exercises only its declared scalar scope, so an unsupported UI scheduling operation is never erased to obtain LLVM success.

## Acceptance that remains required

The following are not discharged by file deletion, a successful AST printer, a scalar kernel, a limited component fixture, or a clean inventory run:

| Obligation | Required completion evidence |
| --- | --- |
| General update scheduling | Preserve callback ordering, reentrancy, update coalescing, intermediate reads, queued work, disposal, and authored updates outside the currently admitted terminal-only form. Rejecting non-terminal/multiple requests keeps this missing; it does not redefine the source contract. |
| Complete exposed state | Preserve `get`, `subscribe`, `spec`, stable handle identity, change payload/reason and disposal behavior, including correct post-dispose rejection. A generated getter alone cannot establish Base Separator or full expose acceptance. |
| Complete lifecycle | Created/mounted/updated/unmounted/before-dispose ordering, attached vs detached ownership, retained state across detach/rebind, terminal cleanup, and no stale queued work. Each target needs actual execution evidence. |
| Context and authored Hooks | Shared imported key identity, distinct same-name keys, providers, updates, subscription cleanup, effect phase and owned resources across components. Fully lower authored behavior; do not restore a Hook interpreter. |
| Full Base/Shadcn/Brutalist behavior | Unmodified full source denominator, event/focus/a11y, Button activation and disabled behavior, rules/patch/suppress/clear, controlled props, style retention, native mixed children, slots, wrappers and capability ownership. Narrow Text/Surface evidence does not establish every family. |
| Other target backends | Vue 3, Vue 2, Web Component, Qt, Flutter and SSR require their own native construction, dependency boundary, build and behavior receipts. Retiring an old profile identifier does not cancel these targets. |
| Browser compilation and production consumers | Actual current source editing → compiler Worker → artifact → iframe consumer, editable/trusted input separation, generated-source ownership, source-bound production assets and cleanup. Old QuickJS/WASM receipts cannot certify a new JavaScript AST Worker. |
| Full CLI/library workflows | Watch/diff, retained last-success result, output ownership, source maps and recovery/error behavior must be migrated and exercised against the current API. Current collision/concurrency assertions cover only their stated cases. |
| Real Shenko application | Its inspected checkout is a React/Web consumer. Source inventory alone is not application build, browser behavior, dependency closure, or production migration evidence. |
| Real Verdant application | Verify the actual application with both its compiler pin and real workspace GPUI dependency. Fork-native component tests, upstream Cargo checks and source inventory remain distinct from replacing the application path. |
| Delivery cost and host/shader behavior | Measure complete dependencies and retained production delivery, cold/warm/incremental compilation, initialization and runtime observations with current components and actual consumers. Preserve original comparison arms and source identities. |

## Historical source tools and evidence

`verify-frozen-foundation.mjs` and `inspect-foundation-definitions.mjs` are retained for read-only provenance checks. `materialize-frozen-foundation.mjs` may restore validated source bytes into a new caller-selected directory, with overlap/existing-target/symlink protections; it performs no dependency install or compiler execution. The current compiler build does not call any of them to acquire an executable old compiler. Their independent controls remain.

The source/archive records, historical delivery/cost reports and immutable website inventory keep their original meanings. The historical cost analysis reader may inspect retained v1 observations without becoming a live compiler API. Its observations cannot be promoted to current target results.

The original `73ff2847` report's 184/184 accepted files and fourteen examples included prototype-runtime wrappers. The subsequent `59c18246` native AST baseline recorded **0/212 Base prototypes emitted on either React or GPUI**, all 184 files analyzed and zero executions. These are named historical snapshots. New coverage requires a fresh inventory of the unchanged complete source denominator and separately retained execution evidence.

Cleanup validation records include original failures as well as later corrections. The first new native consumer rejected an unlowered `run.update()`; the authored operation was retained and the compiler implementation was extended. The first independent CLI harness expected the wrong numeric code for a safely refused symlink; the original failed harness receipt is preserved, and the corrected check continues to require rejection and unchanged foreign bytes. Neither correction removes a product semantic or safety assertion.
