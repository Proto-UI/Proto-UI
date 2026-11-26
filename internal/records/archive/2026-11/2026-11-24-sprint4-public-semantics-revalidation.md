# Sprint 4 public semantic revalidation on integrated main

Date: 2026-11-24 (Asia/Shanghai); execution: 2026-11-23 UTC.

## Result and source boundary

The public compiler's selected dormant-callable, optional/default-callable, readonly-getter and guaranteed-abrupt tests pass on main `d0eb81d3c61c3d3e93e46c4151e78031273d6116`: **127 assertions in eight files**. The public frozen-packet and object-rest verifier tests separately pass **9/9** synthetic controls. No compiler implementation, fixture or assertion changed in this revalidation.

These are new, bounded executions of the public compiler. They are not executions of the original private IR10 candidate or its recovered original failure graphs. The earlier original-input receipts remain bound to their actual executed source revisions in [the Sprint 4 integration record](../../2026-11-22-sprint4-integration.md) and [the public semantic record](../../2026-11-22-sprint4-public-compiler-semantics.md). In particular, the original 270-byte getter input has not been relabeled as a new run, and the original object-rest TS2322 remains an expected language rejection.

The source tree identifiers are:

| Scope at executed HEAD   | Git tree                                   |
| ------------------------ | ------------------------------------------ |
| `packages/compiler/src`  | `6110d45703f5980efad3600e35c5041ca99094e2` |
| `packages/compiler/test` | `02fe7095eee722fad9745e144b2a62a6f34b83e2` |
| `scripts/compiler`       | `5f74f8de5853a6a66d951a76461c679e982ea670` |

The [machine-readable receipt](2026-11-24-sprint4-public-semantics-revalidation.json) records commands, execution times, exit codes, file hashes, per-file counts and hashes of the raw compressed reports. The test runs preceded this record-only change, and their source revision is the executed HEAD above.

## Executed coverage

| Test file under `packages/compiler/test/` | Passed | Bounded evidence |
| --- | --: | --- |
| `dormant-source-admission.test.ts` | 30 | Source admission, reached-body refusal, declaration and cold-IR controls |
| `dormant-callable-consumer.test.ts` | 4 | Generated public Web profile consumers and retained effects |
| `module-callable-selection.test.ts` | 34 | Optional/default selection, aliases, inert cycles, initialization order and phase/capture refusal |
| `module-callable-selection-consumer.test.ts` | 8 | Selected/absent callable behavior through generated public Web consumers |
| `record-getters.test.ts` | 34 | Readonly getter admission, copied data, effects and cold-IR mutation controls |
| `record-getter-consumer.test.ts` | 4 | Real getter execution through generated public Web consumers |
| `record-getter-runtime.test.ts` | 1 | Getter runtime behavior and owner/module state |
| `throw-only-return.test.ts` | 12 | Guaranteed-abrupt completion, declared-return controls and throw identity |
| **Selected semantic total** | **127** | **Eight files; zero failed, skipped or todo assertions** |

The consumer tests use the public compile/write/import entry points with the repository's DOM model. Their four Web profiles are WC, React, Vue 3 and Vue 2; this run does not represent four physical browser or native-platform executions.

The independent Node test command selected `scripts/compiler/verify-frozen-foundation.test.mjs` (eight controls) and `scripts/compiler/verify-object-rest-controls.test.mjs` (one control). These test hash/size/object/reference integrity, path escape and symlink refusal, graph and historical-failure preservation, fixed-anchor substitution rejection, and the additive lawful annotation control. They use authored synthetic inputs. Passing them does not mean the original frozen packet was available or executed here.

## Preserved first attempt and controlled repeat

The first semantic run exited 1: **110 assertions passed**, but four consumer files could not collect tests because the fresh checkout lacked package-level React dependency links. The retained reporter identifies the exact failed import and each affected file. It is not reported as either a compiler regression or a successful eight-file run.

The controlled repeat changed only the environment: declared dependency links were restored from an existing installation with the same `pnpm-lock.yaml` SHA-256, `6e21c4b8444ca5e4a2e427287a76a346137b65d76403579942269bfea1fc7fe8`. Relative workspace package links target the current checkout. No dependency manifest, lockfile, source or assertion was edited, and no fresh-install claim is made. The repeat ran the same eight test files and flags and passed 127/127. Node was `v24.22.3`, Vitest `2.1.9`, TypeScript `5.9.3`, and React `19.2.6`. The repeat's tracked worktree was clean before and after execution.

Both raw reports and their execution receipts are preserved in [`evidence/2026-11-24-sprint4-public-semantics/`](evidence/2026-11-24-sprint4-public-semantics/), alongside the separate verifier log. Compression changes neither the report contents nor the receipt's uncompressed SHA-256; both compressed and uncompressed hashes are indexed in the machine-readable record.

## Issue interpretation

PR [#1714](https://github.com/Proto-UI/Proto-UI/pull/1714) is merged at `3551b85049630877e8c062b4d80a56ec2133c532`. The live #891–#894 bodies and all 17 comments were read for the integration update. The November 22 statements that the PR was still unmerged are historical; their original results and unselected scopes remain valid as recorded. The later `b8d77f3` follow-ups for #892 and #893 are included in that interpretation rather than replaced by this smaller test selection.

- **#891:** original rest input preservation, actual TS2322, the separate lawful annotation control and the primitive/helper versus whole-Prototype boundary were delivered publicly. This run rechecks the public verifier's synthetic control only; it does not rerun the original private two-file graph.
- **#892:** public lazy callable admission is integrated and the selected current controls pass. The old original IR10 42/43 failure and its complete reached-body matrix remain separate.
- **#893:** public readonly getter and guaranteed-abrupt behavior is integrated and the selected current controls pass. The original 270-byte input's historical `c857471` receipt remains its own evidence.
- **#894:** public optional/default callable selection and real generated effects are integrated and the selected current controls pass. The complete original three-file graph's `ef60557` receipt remains separate from this current suite.

The original full IR10 candidate conditions remain open: genuine source rights and DCO, precise shared-definition owner decisions, reconstructable public dependency layers, the original compiler's full source and input closure, and independent acceptance. The public IR7 results do not authorize checking those conditions as complete. See [the original recovery ledger](../../2026-11-22-sprint4-ir10-recovery.md) and #913–#915.

This selection does not claim a full compiler, full workspace, physical browser, hardware, assistive-technology, non-Web, release or original IR10 acceptance run.
