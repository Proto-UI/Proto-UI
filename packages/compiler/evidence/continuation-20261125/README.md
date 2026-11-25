# Compiler continuation verification — 2026-11-25

This receipt belongs to the final continuation worktree on `feat/compiler-ast-pipeline-1809`, based on `59c18246275c9a5ed0ad313c6da2627956930597`. The exact source/test/native-builder bytes are recorded in `source-hashes.json`; it does not relabel the earlier commit's receipts as results for this work.

## Executed source gates

| Gate | Result |
| --- | --- |
| Complete compiler Vitest | 17 files, 117 passed, 0 failed, 0 skipped |
| Compiler strict TypeScript | exit 0 |
| Workspace TypeScript | exit 0 |
| Real source-mode native React consumer | exit 0 |
| Complete React Base inventory | 184 files, 212 prototypes, 214 authored hooks; 2 emitted, 210 unsupported, 0 source errors |
| Complete GPUI Base inventory | same complete denominator and outcome counts |

The emitted definitions are the unchanged official Base Text and Surface. Inventory does not execute components; executionVerifiedPrototypes remains zero. Source-driven React/GPUI/browser tests provide separate bounded execution evidence. Full Base/family lowering and real Shenko/Verdant application migration remain required.

The 117 tests consist of frontend HIR 15, declaration/action composition 18, initialization proof 20, action update ordering 3, React AST 11, source React 4, real Base React 3, browser memory host 5, GPUI AST 10, CLI 6, Base reporting 1, SSA 3, LLVM builder 8, LLVM pipeline 3, kernel admission 2, WASM ABI 3 and native asset location 2.

## Specification and documentation

Spec authoring, all 13 catalog evidence-integrity controls, generated agent documentation and the public-docs check passed. The last check covers 458 maintained repository documents. Commands and complete logs are retained in `receipt.json` and `docs-gates.tar.gz`. Initial catalog runs rejected new cited files before they were entered into the Git index; those failures remain archived alongside the final passing run. No test was removed or weakened to resolve them.

## Semantic review

The independent [initialization review](initialization-review/README.md) retains the original failing reproductions and the final source-bound checks. The final 20 TypeScript cases include TDZ through module/setup/action helpers, const callees and aliases, unreachable captures, unknown ambient reads, direct and hoisted-function-mediated module cycles, and style intrinsic aliases. Positive controls preserve initialized captures and ordinary helper composition.

Callback defaults and async/generator rule intents are explicitly rejected until their argument/execution semantics can be represented. Captures not proved initialized at registration/return remain conservatively unsupported. Neither such rejection nor a passing diagnostic test counts as implementing that valid language subset.

## Separate target and packaging evidence

- [GPUI native execution](../../native/rust-builder/test-support/evidence/continuation-20261125-summary.md) records 13 fork-native tests and independently locked fork/upstream builds.
- [Browser execution](../browser-ast-20261125/README.md) records real Chrome Worker/native-preview cases and retained generated TS/JS and DOM.
- [Legacy cleanup](../legacy-cleanup-20261125/README.md) records migrated tools, output-publication controls and original failed attempts.
- [Installed-package verification](../pinned-package-39ea50a0/README.md) passed against the exact clean code commit `39ea50a0635be857734461a7af1bd6e61ecd70a6`, with installation, relocation, cold native builders, CLI protection and independent React consumption. Raw consumer environment failures and SDK-bound admission results remain separate from that package acceptance.

## Raw evidence

`receipt.json` records commands, exits, durations, exact suite counts and artifact hashes. `base-inventory-summary.json` preserves complete-denominator accounting. `source-gates.tar.gz` retains full final logs, full inventory reports, JSON Vitest assertions and previous stage results (including failed attempts). Earlier logs are not overwritten or presented as final results.

The execution host is doesworkstation. This evidence does not claim a deployed docs-route acceptance, all former targets, all prior regression suites, full Base coverage or complete real application migration.
