# Initialization proof: independent review receipt

## Final verification

| Check | Result | Evidence |
| --- | --- | --- |
| Independent initialization regression | 20 passed, 0 failed, 0 skipped | [Complete log](final-tests.log.gz) |
| Original correctness reproductions | All 7 incorrect acceptances now have explicit diagnostics; source TypeScript remains valid | [TDZ](final-tdz.jsonl), [callback and rule boundaries](final-boundaries.jsonl) |
| Supplemental controls | 10 cases, 0 mismatches | [Results](final-extra-controls.jsonl) |
| Style alias reproduction | Explicit target rejection | [Result](final-style-alias.jsonl) |
| GPUI AST generation with final frontend | 10 passed, 0 failed, 0 skipped | [Complete log](gpui-ast-tests.log.gz) |
| GPUI artifact continuity | 17 crates, 34 files, all byte-identical; no missing or extra crate | [Identity report](gpui-artifact-identity.json) |

The portable repository test is [initialization-proof.test.ts](../../../test/initialization-proof.test.ts). Its 15 rejection cases cover module/setup/callback TDZ, unknown ambient module reads, captures after registration or an earlier return, const callees and aliases, value-import cycles including reads hidden by hoisted functions, and style aliases in render/rule/setup helpers. Its 5 positive controls cover hoisted functions, already initialized captures, initialized setup/style aliases and once-only helper argument binding.

Every entry and imported virtual fixture passes the real TypeScript source checker before semantic admission is asserted. Import-cycle fixtures stay in the in-memory Program and do not introduce invalid workspace files.

## Findings and admitted scope

The original findings were initialization-order errors, deleted root-callback default-parameter effects, and generator rule intents incorrectly treated as executed. A follow-up found parent initialization points missing from style-intrinsic alias resolution.

Caller execution points now remain available during lowering, and constant initializers are checked at their own declaration point. Unproven reads receive explicit diagnostics. This is bounded admission: a callback capturing a setup local initialized only after registration is currently rejected even when a full deferred-execution analysis could prove it valid. Already initialized captures continue to compile.

Generator intents and unlowered callback parameter effects are explicitly unsupported; their rejection is not counted as newly implemented runtime behavior.

## Original review evidence

- [Original TDZ source](before-p1-tdz.source.txt), [incorrect acceptance](before-p1-tdz.jsonl) and [source hashes](before-p1-source-sha256.json).
- [Original callback/default, generator and ambient-read source](before-p1-boundaries.source.txt) and [output](before-p1-boundaries.jsonl).
- [Style alias source](before-style-alias.source.txt), [incorrect acceptance](before-style-alias.jsonl) and [pre-fix 20-case regression](before-style-tests.log.gz): 17 passed and 3 failed.
- [Intermediate source hashes](after-initial-fix-source-sha256.json) refer to the earlier 16-case test version and do not replace the final 20-case receipt.

Historical standalone scripts retain their actual execution-worktree paths and are stored as text, outside workspace TypeScript compilation. The repository test is the portable regression.

## GPUI native evidence continuity

Final-source generation used a new empty directory recorded in [gpui-artifact-identity.json](gpui-artifact-identity.json). All 17 generated crate manifests and Rust sources were compared byte for byte with the unchanged tested harness artifacts.

All 34 files match. This connects the final frontend to the earlier [13-test fork native receipt](../../../native/rust-builder/test-support/evidence/continuation-20261125-fork-native.txt), [fork Cargo check](../../../native/rust-builder/test-support/evidence/continuation-20261125-fork-check.txt) and [upstream pinned Cargo check](../../../native/rust-builder/test-support/evidence/continuation-20261125-upstream-check.txt). Those native tests and Cargo checks were not rerun for this identity check. Golden files and GPUI backend sources were not modified. This does not claim validation or migration of the entire Verdant application.

## Commands and integrity

```sh
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/initialization-proof.test.ts
PUI_GPUI_ARTIFACT_DIR=<new-empty-directory> corepack pnpm@10.32.1 exec vitest run packages/compiler/test/gpui-ast-codegen.test.ts
```

[Final status](final-status.json) records command exits, reproduction assertions and stable input hashes during verification. [Final source hashes](final-source-sha256.json) identify the reviewed implementation and test; [summary](summary.json) records counts and scope. Verbose logs are losslessly gzip-compressed, preserving existing ES2024/esbuild warnings.

JSON and Markdown were formatted before [SHA256SUMS.json](SHA256SUMS.json) was computed. The manifest hashes every other file and excludes itself. The reviewer added the independent test and this evidence package; the parent agent owns frontend fixes.
