# Native React browser execution

This record verifies the compiler and preview in actual headless Chrome after the final initialization-order, callback-parameter and render-style alias fixes. Seven case groups passed; both observed compiler Workers were terminated, and the 42 compiler source files were unchanged across the run.

The candidate was an uncommitted worktree based on `59c18246275c9a5ed0ad313c6da2627956930597`. That SHA identifies the starting revision, not the compiler bytes exercised here. The exact compiler bundle, authored environment, 175 build inputs and generated artifacts are identified by the receipts below. Installed-package pin verification is a separate obligation.

## Executed behavior

| Case | Observed result |
| --- | --- |
| Actual Base Text source | Compiled through the real memory TypeScript Program and shared semantic pipeline; native React mounted caller content without fabricated role or tab index. |
| Actual Base Surface source | The unchanged official source compiled and mounted with the same passive host semantics. |
| Edited Base Text source | Editing the actual source to add a style token changed the class on the compiled host. |
| Native events and explicit update | A state-only click retained template text `0`; a terminal authored update published text `1`. Both DOM observations are retained. |
| Authored module effect | Compilation rejected the effect; it ran in neither the page nor the compiler Worker. |
| Native-toolchain target boundary | A GPUI request returned an explicit unsupported browser diagnostic and retired the preceding preview. |
| Integrity, cancellation and reopen | Tampered compiler bytes were rejected; cancellation retired the Worker and preview; reopening mounted a fresh counter at `0`. |

The final run used Chrome `156.0.8078.47` and TypeScript `5.9.3`. The compiler bundle SHA-256 is `776467b51a0a7158d14c55d56ee1394a76f64eb272cf695eb791372706c7d556`; the trusted authoring environment SHA-256 is `05cda317e29257f882297a7fb1e6aaed601fcfa113ff5c7a40760c259b36b156`.

## Receipts

- [summary.json](summary.json) records all seven cases, the 175 input hashes, the observed Worker lifecycle, and eight observation files with their byte counts and SHA-256 hashes.
- [run.json](run.json) records the actual command, successful exit, worktree status and before/after compiler source stability.
- [controls.json](controls.json) records the separate 108 boundary regressions, 10 asset/evidence/root controls, strict website browser source type check, and successful full coverage-matrix validation.
- [receipt.json](receipt.json) binds the raw archive and distinguishes worktree browser execution from a final installed package or documentation-route acceptance.
- [browser-receipts.tar.gz](browser-receipts.tar.gz) preserves the exact final compiler bundle and build manifest, all eight actual requests/Worker results/DOM observations, input metadata, command output, control logs and earlier failed attempts.

Inside the archive, `final/observations/*.json` contains the original authored input, the Worker-returned TypeScript and JavaScript, diagnostics where rejected, and the actual preview DOM. In particular, `state-only.json` and `explicit-update.json` retain the two distinct template frames. These raw observations remain inside the archive so formatting hooks cannot rewrite their recorded bytes.

The earlier records include the preview CSP nonce failure, the previously unreviewed executable boundaries, the source-drift refusal during a concurrent evidence edit, and a background-runner syntax error that occurred before Node execution. They remain historical attempts and are not counted as passing compiler runs.

## Boundary review

The browser uses the same frontend, semantic IR verification and React AST emitter as the Node compiler. Emitted components import only React. The preview receives one generated component module and a fixed set of framework modules; original prototype modules and Adapter/Runtime wrappers are not executed.

Three executable edges have exact path, complete source digest, unique call site and companion producer/validator/caller bindings: the verified Blob Worker construction, the preview import map, and the literal generated-component import. The 108 passing regression controls include second unknown Worker/script sites, a removed digest check, changed producers, missing companions, adjacent source paths, source/owner drift and the existing general script rejections. No Worker category, directory prefix or arbitrary dynamic-import allowance was added.

## Recorded commands and remaining scope

The final browser command was:

```sh
node scripts/compiler/browser-ast-smoke.mjs --out /tmp/pui-browser-ast-execution-final-p1-20261125
```

Use a fresh `--out` directory when reproducing it. The raw archive also preserves the exact boundary-test command, asset/evidence tests, `node scripts/coverage-matrices/check-coverage-matrices.mjs`, and the seven-file strict website type-check configuration and output.

This is a standalone owned-loopback browser execution, not acceptance of a published documentation route. `documentationRouteAcceptance` remains `not-run`. Accessibility, surrounding editor/Run/Cancel controls, cross-browser behavior, full Base support and full application migration remain separate obligations. Historical Web Component, React profile, Vue 3 and Vue 2 target obligations remain `not-migrated`; this native React slice does not close them.
