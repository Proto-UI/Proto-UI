# Installed compiler package at 39ea50a0

**Code pin:** `39ea50a0635be857734461a7af1bd6e61ecd70a6`.

The package was built from a clean checkout at this exact commit, installed with `npm ci --ignore-scripts`, moved as a complete directory, and exercised with a fresh native builder cache. Every installed-package smoke gate passed. The full run is recorded as `completed-with-consumer-admission-failures` because both untouched consumer checkouts lacked their authoring SDK dependencies.

An evidence-only commit may contain this directory later. The compiler code and package identity remain pinned to the SHA above.

## Verified package behavior

| Check | Observed result | Scope |
| --- | --- | --- |
| Package build, installation and relocation | Exit 0; every recorded package file retained its original bytes through installation, relocation and execution | Relocatable v3 JavaScript API/CLI, native builder source assets and the separate `kernel-host` export |
| Installed React API and CLI | Exit 0; actual ordinary React SSR rendered the generated component | The controlled pinned-counter fixture and React-only generated imports |
| Installed LLVM builder and kernel host | Exit 0; the C++ IRBuilder emitted a verified module, the module became WASM, and the shipped host executed it | Signed zero, NaN, state initialization and checked state access in the separate scalar fixture |
| Installed GPUI backend | Exit 0; the locked Rust AST builder was built in a fresh cache and emitted native GPUI component source | Rust AST generation; full native application execution has separate evidence |
| Installed CLI and independent React consumer | Exit 0; actual collisions, explicit overwrite, directory/file symlinks and two concurrent writers were checked, followed by independently mounted and edited React output | The maintained native-consumer assertions, including explicit update scheduling |
| Library coordinator | Exit 0; all four selected worker rows completed | Text emitted for React and GPUI; Button returned explicit unsupported results for both |

The worker report retains the entire library universe: **1,015 authored source files, 11 target/profile rows per file, and 11,165 rows**. Its statuses are 2 `PASS`, 2 `UNSUPPORTED`, 2,026 `UNTESTED`, and 9,135 historical `UNIMPLEMENTED` obligations. `selectedComplete` is true; `admissionCoverageComplete` is false. Its native emission count is 2 and its execution count is 0. This bounded worker check does not replace the separate full Base inventory.

## Real consumer observations

| Consumer | Untouched checkout | Explicit candidate authoring SDK mapping | Execution and migration |
| --- | --- | --- | --- |
| Shenko at `4f24740cef3832978ca97bb26acaf7207b4acc7c` | Exit 1; `TS2307` for missing `@proto.ui/core`, with the dependent type diagnostics preserved | Exit 0; the unchanged `transport-badge.proto.ts` yielded one admitted prototype and one native React emission | Zero executed prototypes; application migration remains unverified |
| Verdant at `44aeee6383b8e3257c56b812f8cd7ada13e04bbe` | Exit 1; `TS2307` for missing `@proto.ui/core`, with the dependent type diagnostics preserved | Exit 0 for the admission survey; the unchanged `pitch-gesture-surface.proto.ts` yielded one explicit `PUI_GPUI_UNSUPPORTED` result because native `expose` lowering is absent | Zero emitted or executed prototypes; application migration remains unverified |

The SDK-mapped observations use an external cached TypeScript configuration and copies of Core/Types from the same candidate commit. They are separate compatibility experiments. Neither consumer checkout, its tracked source bytes nor its Git identity changed. The records preserve the exact mapping, source/type hashes, diagnostics and counts. An admission-survey exit code of 0 does not make an unsupported prototype compiled.

## Files and archive review

- [summary.json](./summary.json) is the formatted result index and scope statement.
- [receipt.json](./receipt.json) binds the published files and every retained raw archive entry by SHA-256.
- [proto-ui-compiler-39ea50a0.tar.gz](./proto-ui-compiler-39ea50a0.tar.gz) contains the exact pinned package without installed `node_modules`; install its recorded dependency before use.
- [validation-receipts.tar.gz](./validation-receipts.tar.gz) preserves the actual command stdout/stderr, exit records, source identities and hashes, all library worker outcome rows, and the consumer diagnostic reports. It also includes the validation-only orchestration scripts needed to reproduce the explicit SDK mapping.

The published receipt archive was selected from the original immutable cache archive without changing the bytes of retained entries. Copied authoring SDK/runtime source trees, generated component/IR/WASM bodies and native build cache contents were excluded; generated fixture artifacts are represented by hashes. No other consumer repository's original source or generated business component is included. Both real consumer reports were checked to contain identities, hashes, declaration counts and diagnostics only. The original broader archive and its hash remain recorded as provenance.

## Reproduction

Use a clean checkout of the recorded code pin with its declared build dependencies and Node 24. Select new output directories for each run:

```sh
node --import tsx scripts/compiler/build-pinned.ts --revision 39ea50a0635be857734461a7af1bd6e61ecd70a6 --output /tmp/fresh-pinned-compiler
npm --prefix /tmp/fresh-pinned-compiler ci --ignore-scripts --no-audit --no-fund
node scripts/compiler/pinned-ast-smoke.mjs --compiler /tmp/fresh-pinned-compiler/index.js --llvm --gpui
NATIVE_CONSUMER_COMPILER=/tmp/fresh-pinned-compiler/index.js node scripts/compiler/pinned-cli-smoke.mjs
```

The archived runner additionally moves the entire package to another directory, snapshots the authoring SDK and installed React dependency closure, selects a fresh `TMPDIR`, runs the two-entry coordinator, and records untouched-checkout and SDK-mapped consumer admission separately. LLVM and GPUI checks require their actual toolchains.

General lifecycle/context/expose coverage, the complete Base and other library families, retired targets, full Shenko/Verdant application migration, physical browser/accessibility acceptance, and historical watch/diff workflow obligations remain governed by the compilation specification and cleanup ledger.
