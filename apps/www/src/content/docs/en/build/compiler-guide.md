---
title: 'Compiler Guide'
desp: 'The current private native AST compiler and the separate 0.2 release boundary'
description: 'The current private native AST compiler and the separate 0.2 release boundary'
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

The production route shipped in 0.2 is:

```text
Prototype TypeScript → Runtime execution → official Adapter → Web host
```

A Compiler route was not shipped in 0.2:

```text
portable analyzable input → [future Compiler] → host artifacts
```

Nothing in 0.2 promises the second route's accepted source language, optimization model, generated files, runtime footprint, or compatibility policy.

## Constraints that already apply

Although 0.2 did not ship a Compiler package, cataloged protocol boundaries constrain compiler implementations:

- `K-PROTOTYPE-COMPOSITION-0001`: templates describe one Root Node; they do not embed another Prototype definition.
- `C-TEMPLATE-0005`: the v0 slot is anonymous, singular, and parameterless.
- `C-TEMPLATE-0006`: an official Adapter or Compiler encountering `PrototypeRef` as a template node must reject it rather than inventing private composition.
- `C-RULE-0003`: Rule declarations produce serializable `RuleIR` without functions, host references, closures, or live handles.
- `C-MODULE-DECLARATION-0001`: static typed Module declarations are available before Module construction and potential host selection.

These are protocol constraints, not a Compiler SPI. They do not specify a parser, AST format, incremental build graph, code generator, or deployment artifact.

## Static intent versus arbitrary functions

Some authoring forms preserve more analyzable intent than callbacks. Rule separates condition from semantic intent and compiles internally to `RuleIR` for Runtime evaluation. That representation alone is not a complete Prototype compiler. The private AST compiler described below analyzes callback control flow explicitly and diagnoses forms it cannot preserve.

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

## Private repository AST compiler

The private repository package uses a TypeScript binding/type frontend, semantic HIR, explicit target admission and native target builders. React output is constructed with TypeScript AST nodes; GPUI output uses Rust syntax nodes; LLVM kernels use the native LLVM IRBuilder. Unsupported operations produce diagnostics. There is no fallback that imports the authored prototype into a Proto Runtime or Adapter.

This is draft implementation work, not a 0.2 release guarantee. The governing direction and acceptance obligations are recorded in `D-COMPILER-ARCH-0001`, `C-COMPILER-PIPELINE-0001` and `T-COMPILER-PIPELINE-0001`. `packages/compiler/README.md` and `internal/compiler/v2-compilation-spec.md` describe the source and evidence boundaries.

### Targets and actual coverage

| Target | Output and boundary |
| --- | --- |
| `react` | Ordinary React component source built through the TypeScript factory and printer. Only admitted authored operations are emitted. |
| `gpui` | A Rust crate with a native GPUI component, built through `syn` and `prettyplease`. Generation needs Cargo; execution requires a compatible GPUI host. |
| `kernel` | A scalar kernel built through LLVM's native object API. It is not a whole UI component or GPUI backend. |
| `ir` | Semantic analysis, including unresolved operations. Analysis does not count as native emission. |
| Vue3, Vue2, Web Components, Qt, Flutter and SSR | Their original implementation and consumer obligations remain open. An old profile name cannot invoke a hidden retired backend. |

The first source-bound AST delivery at `59c18246275c9a5ed0ad313c6da2627956930597` analyzed 184 Base files containing 212 prototype declarations and 214 authored Hooks. Both React and GPUI emitted **0/212** Base prototypes at that snapshot. Each target separately recorded 212 unsupported declarations, five hook-only files and zero executed prototypes. Those historical counts remain in `packages/compiler/evidence/ast-pipeline-20261125/`; subsequent capabilities need new reports.

The current continuation emits **2/212 on each target**, the unchanged `base-text-root` and `base-surface-root`, through generic lowering. All 184 files remain analyzed: 210 prototype declarations are unsupported, with 177 unsupported files, five Hook-only files, two emitted files and zero source errors. `executionVerifiedPrototypes` remains zero in the inventory. Actual React and GPUI tests exercise those Base sources separately; they do not establish full Base/family coverage or whole application migration. The current summary is retained in `packages/compiler/evidence/legacy-cleanup-20261125/base-inventory-summary.json`.

An emitter, a successful isolated fixture, a whole-library inventory and a real application migration are different claims. Inventories retain unsupported, source-error and hook-analysis rows. They never turn a wrapper, an IR dump or a declaration into an executed native component.

### Browser and website boundary

The website inventory preserves authored registration/source graphs and every historical rejected demo. It records current React source admission separately from unfinished historical Web Components acceptance. Node compilation does not establish Worker execution, iframe preview, physical input, cleanup, pixel or accessibility acceptance.

Browser delivery has its own source-bound receipts. A React AST Worker receipt cannot reuse an old QuickJS/WASM receipt. GPUI and LLVM toolchain requirements must be reported explicitly. Existing demo and frame ownership conventions remain applicable.

### Compile and inspect locally

Run these commands from the repository root with the declared Node 24 and pnpm toolchain:

```sh
node --import tsx scripts/compiler/pinned-cli-entry.ts info
node --import tsx scripts/compiler/pinned-cli-entry.ts check packages/prototypes/base/src/button/button.proto.ts --target react --json
node --import tsx scripts/compiler/pinned-cli-entry.ts inventory packages/prototypes/base/src --target react --json
node --import tsx scripts/compiler/pinned-cli-entry.ts compile path/to/entry.proto.ts --target react --out .cache/generated --json
```

The `check` command may reject a valid prototype whose operations are not yet lowered. Preserve its authored behavior. Do not rewrite the prototype, omit operations or select a runtime wrapper to obtain success.

Choose `--target gpui` for Rust components, `--target kernel` for a kernel or `ir` to inspect HIR. Output is protected from accidental replacement; `--overwrite` explicitly replaces generated files. Inputs and symlink destinations remain protected. Historical `--profile`, `diff` and `watch` interfaces are unavailable; unfinished ownership and consumer acceptance remains in the cleanup ledger.

### Build and consume an exact source pin

A pinned artifact requires a clean checkout and an exact full commit SHA:

```sh
node --import tsx scripts/compiler/build-pinned.ts --revision "$(git rev-parse HEAD)" --output /absolute/fresh-compiler-package
npm --prefix /absolute/fresh-compiler-package ci --ignore-scripts
node /absolute/fresh-compiler-package/cli.js --build-info
node scripts/compiler/pinned-ast-smoke.mjs --compiler /absolute/fresh-compiler-package/index.js --llvm --gpui
NATIVE_CONSUMER_COMPILER=/absolute/fresh-compiler-package/index.js node scripts/compiler/pinned-cli-smoke.mjs
```

The package contains the current API/CLI and source-bound native builder assets. Metadata uses `proto-ui.compiler-package.v3`; identity comes from `compiler-build.json` or `--build-info`. Removed `compilerBuildIdentity`, `TARGET_PROFILES`, `compilationArtifacts` and runtime-profile APIs are not compatibility shims.

The current React consumer checks strict generated TypeScript, props/state/update behavior, instance isolation, styles, listener cleanup and editable output:

```sh
node --import tsx scripts/compiler/native-consumer-smoke.mjs
```

For a real application, inspect unchanged authored inputs through an installed pin:

```sh
node scripts/compiler/consumer-project-inventory.mjs --compiler /absolute/fresh-compiler-package/index.js --consumer-root /absolute/shenko --name Shenko --target react --out /absolute/fresh-shenko-inventory.json
```

This command does not rewrite the application. It retains `applicationMigrationVerified: false` and zero execution claims. Shenko's Web consumer and Verdant's GPUI consumer require their own application acceptance. Using Verdant's GPUI fork in a harness is not an application migration.

### Retired implementation and preserved obligations

Old runtime/source-template generators and obsolete execution harnesses have been removed from maintained entry points. Their exact source remains in Git history. `internal/compiler/legacy-cleanup.md` maps independent assertions to current tests and retains unfinished full-family behavior, context/expose ownership, missing backends, browser/native acceptance, watch/diff and production cost evidence.

Frozen-foundation tools only verify hashes, inspect definition identity or materialize authenticated source bytes into a new directory. They never install or invoke the old compiler and are not dependencies of the current build.

## Contribution and verification boundary

Implement shared definitions independently in the compiler and prototype. Preserve lifecycle, state, props, event, template, slot and host ownership rules. TypeScript checking does not perform Proto effect/phase analysis; LLVM does not replace UI ownership or target admission.

Use the compiler's strict type check, focused target/consumer tests and repository documentation checks. Report exact source, generated artifacts, executed targets and remaining obligations. A documentation or inventory-accounting pass does not establish application acceptance.
