# Pinned compiler package mechanism snapshot

This evidence belongs to temporary commit `01a33b38f28782838c1baf76f78041b7a3a73fcc` in an independent local clone. It is **not the final candidate commit or a release pin**. The final source commit must pass its own clean-pin build and consumer verification.

The build retained the full-SHA and clean-checkout gates. It emitted 14 package files, including `native/llvm-builder.cpp`, the Rust builder's `Cargo.toml`, `Cargo.lock`, and `src/main.rs`. The package was moved to another directory and installed using `npm ci --ignore-scripts --no-audit --no-fund`; the only installed compiler package dependency was TypeScript.

Before consumption, this temporary clone's original native source directory was moved out of the source tree. A new `TMPDIR` forced separate native builder caches. Plain Node then exercised the current JavaScript API and CLI, emitted a native React component and rendered it using ordinary React 19 packages, compiled the packaged LLVM IRBuilder source and verified its module with LLVM, and built the locked Rust syntax driver to emit a GPUI component. The source and relocated bundle asset locator tests also passed 2/2.

`receipts.tar.gz` contains the original build/consumer logs, process exit records, package metadata, CLI stdout/stderr, authoring fixture, generated target files, asset test log, and an inventory of their original bytes and hashes. The archive preserves raw receipts independently of formatting applied to this explanatory directory. Its SHA-256 is recorded in `summary.json`; `SHA256SUMS.json` lists the archived receipt members.

The tested packaging-script SHA-256 was `70675d5794f1f9b69efadb28a65d7f06de11953f2774b969a1e79ed78ef0b6cb`. Subsequent changes added `tsconfig.json` to the package input hash inventory and moved the asset test's Node-environment directive to its conventional first line. Those changes do not turn this temporary snapshot into final-candidate evidence.

The package smoke is implemented by `scripts/compiler/pinned-ast-smoke.mjs` with `scripts/compiler/fixtures/pinned-counter.proto.ts`. The asset locator tests live in `packages/compiler/test/native-assets.test.ts`.

This smoke does not establish full Base-prototype coverage, full application integration, browser layout behavior, or a GPUI application's native execution. Those obligations retain their separate acceptance tests.
