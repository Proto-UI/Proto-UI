# Compiler tools

Run these tools from the repository root with Node 24 and the repository's declared Corepack/pnpm version. The current compiler API is [`createCompiler`](../../packages/compiler/src/index.ts); its target registry is [`targets/kinds.ts`](../../packages/compiler/src/targets/kinds.ts). React and GPUI are component targets. `ir` analyzes a definition and `kernel` emits an explicitly admitted scalar kernel. Neither is an additional complete UI backend.

The [compiler README](../../packages/compiler/README.md), [compilation specification](../../internal/compiler/v2-compilation-spec.md), and [cleanup ledger](../../internal/compiler/legacy-cleanup.md) define the implementation and evidence boundaries. This directory does not supply an alternate compiler, restore a frozen compiler to run current checks, or synthesize target source from runtime templates.

## Maintained tools

| Entry | Purpose and effects | Evidence boundary |
| --- | --- | --- |
| `build-pinned.ts` | From an exact clean commit, builds a relocatable JavaScript API/CLI package, records actual dependencies and source hashes, and copies the native LLVM/Rust builder sources. Writes a new output directory. | Package identity and native asset closure; requires separate installed-package execution. |
| `pinned-cli-entry.ts` | Source entry used to bundle the current CLI. | The maintained CLI has `info`, `check`, `ir`, `llvm`, `compile`, and `inventory`; no old profile aliases or fake `watch`/`diff` commands. |
| `pinned-ast-smoke.mjs` | Executes an installed v3 package through plain Node, then checks ordinary React SSR and optional LLVM/GPUI builders in a relocated consumer. | Package/API/CLI and stated target-build checks; its pure kernel fixture is separate from the UI fixture with an explicit update request. |
| `native-consumer-smoke.mjs` | Compiles a definition through the current API, strictly type-checks the React artifact, copies its real React package closure, mounts it in Happy DOM, edits the generated source, and rebuilds it. | Actual target execution in a DOM implementation; no physical browser, full application, pixel, or accessibility-tree claim. |
| `pinned-cli-smoke.mjs` | Runs the same installed package through CLI collision, explicit-overwrite, symlink and concurrent-writer checks, then the independent native consumer. | Real CLI processes and current React consumer assertions; original watch/diff, source-map ownership and complete workflow obligations remain separate. |
| `consumer-project-inventory.mjs` | Reads selected unchanged sources from a real consumer Git checkout through an installed v3 package, binds source/type inputs and package files, and writes a new report. | Admission and emission only. It always records zero executed prototypes and `applicationMigrationVerified: false`. |
| `library-profile-inventory.mjs` | Inventories the complete authored source denominator with a fresh bounded worker per entry, preserves current target outcomes and retired-profile obligations, supports resume/shards, and checks source-bound receipts. | `PASS` means native artifacts were emitted; `ANALYZED` is Hook-only analysis; `UNSUPPORTED` and compiler/input failures stay separate. It does not run the UI. |
| `website-demo-inventory.mjs` | Discovers website examples and migration sources, records editable local source closure, and checks current React admission. Regenerates the canonical inventory. | Node admission is not browser Worker/iframe execution. Historical WC/profile obligations stay visible. |
| `current-api.mjs` | Shares target-inventory, artifact, and TypeScript source-binding helpers among the maintained tools. | No generated component behavior, legacy API emulation, or compiler execution fallback. |
| `verify-object-rest-controls.mjs` | Retains ordinary TypeScript control evidence and checks the current compiler's semantic analysis of the authored form. | HIR analysis is explicitly distinguished from target-native acceptance. |
| `host-cost-observer.mjs` | Calibrates and records selected host calls around an independently executed consumer. | Reusable observation only; raw host call counts are not total dependency, retained bundle, startup, or performance equivalence. |

The inventory's compiler-owned component list contains only implemented targets. Retired identifiers such as `react-runtime-v1`, Vue/WC, Qt, Flutter and SSR profiles remain **non-executable acceptance rows**. Their original semantic and consumer obligations need new native evidence. Keeping those rows does not authorize restoring the old interpreter or count them as supported targets.

The adjacent [`GPUI source audit`](../gpui/audit-source-lowering.mjs) consumes current semantic HIR and records actual generated Rust/Cargo bytes with zero execution claims. The independent [Cargo graph checker](../gpui/check-cargo-graph.mjs) requires explicit dependency identities; its retired `--profile` option is rejected. The [dependency guide](../../internal/compiler/gpui-dependency-migration.md) keeps the historical application pins and graph obligations distinct from current native AST evidence.

## Reproducible commands

Build from a clean, exact source pin into a new directory, then install its recorded TypeScript dependency:

```sh
node --import tsx scripts/compiler/build-pinned.ts --revision <full-HEAD-SHA> --output /tmp/proto-compiler-package
npm --prefix /tmp/proto-compiler-package ci --ignore-scripts
node /tmp/proto-compiler-package/cli.js --build-info
node /tmp/proto-compiler-package/cli.js info
node scripts/compiler/pinned-ast-smoke.mjs --compiler /tmp/proto-compiler-package/index.js --llvm --gpui
NATIVE_CONSUMER_COMPILER=/tmp/proto-compiler-package/index.js node scripts/compiler/pinned-cli-smoke.mjs
```

The LLVM and GPUI options require the actual corresponding SDK/toolchains. A missing tool, rejected definition, failed native build, or killed subprocess is a failure or unsupported result, never a successful skipped validation.

For current source work and source-bound inventories:

```sh
node --import tsx scripts/compiler/native-consumer-smoke.mjs
node --test scripts/compiler/current-api.test.mjs scripts/compiler/library-profile-inventory.test.mjs scripts/ci/test/compiler-library-inventory.test.mjs scripts/compiler/website-demo-inventory.test.mjs scripts/compiler/verify-object-rest-controls.test.mjs
node --import tsx scripts/compiler/library-profile-inventory.mjs --output /tmp/compiler-library-inventory
node --import tsx scripts/compiler/website-demo-inventory.mjs
node scripts/compiler/consumer-project-inventory.mjs --compiler /tmp/proto-compiler-package/index.js --consumer-root /path/to/consumer --name consumer --target react --out /tmp/consumer-inventory.json
```

The complete library inventory requires a clean source identity. Do not remove its source/worker binding checks to run against a changing worktree. Its summary distinguishes a completed admission survey from successful compilation of every source. The website generator preserves the immutable #829 snapshot in `website-demo-migrations-829.json` and updates `internal/compiler/website-demo-migrations.json`; regenerate only after its maintained inputs are stable. Browser-specific build, source registration, production assets and execution receipts are owned by the adjacent `browser-*` tools and must name the actual current implementation.

## Historical source verification

Three tools remain to establish the provenance of an old foundation packet. They are not maintained compiler execution paths:

| Tool | Permitted operation |
| --- | --- |
| `verify-frozen-foundation.mjs` | Read a caller-supplied packet/archive; verify its manifest, hashes and Git object closure. It reports `originalCompilerReplay: false`. |
| `inspect-foundation-definitions.mjs` | Read a caller-selected exact Git commit and the anchored definition inventory; report identities and differences without changing that checkout. |
| `materialize-frozen-foundation.mjs` | Restore validated source bytes into a caller-selected **new directory** with overlap, existing-target and symlink protections. This operation writes source material; it never installs, invokes, or restores the old compiler as an executable service. |

Current builds and tests must not call `materialize-frozen-foundation.mjs` to recover an old compiler. Historical records, frozen manifests and original receipts keep their original bytes and scope; failures are preserved. Their controls remain in the neighboring `*.test.mjs` files. The [cleanup ledger](../../internal/compiler/legacy-cleanup.md) maps removed execution harnesses to migrated assertions and still-missing acceptance.
