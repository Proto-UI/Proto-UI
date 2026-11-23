# PR #1743: retain source profile and material producer boundaries

This bounded follow-up preserves the upstream GPUI-only `scroll.sync` profile repair and reconciles one exact diagnostic material helper with its actual source graph. It does not extend Web source support, runtime behavior, catalog lifecycle or the public API.

## GPUI source admission

The ordinary merge of main `457d27f7fe554f398970a836ee9c95edb4846f47` retains the original-author production change in `packages/compiler/src/targets.ts`, blob `f296e5e5a49e0b9ba410cdd334d57f67b41b861d`. The operation remains outside all four Web source profiles.

Four added controls use the complete `compilePrototype(source, { profile })` admission path. Each requires the same `PUI4003` / `unsupported-input` diagnostic to name `scroll.sync` and its Web profile. Existing tests remain unchanged. The final three-file GPUI test selection ran on Node 24.22.3 with 512 MiB heap: **29 passed, zero failed or skipped**, exit 0. This is source/compiler evidence, not Cargo or native GPUI execution.

## Exact material helper closure

The production bundle checker adds only `packages/adapters/base/src/material/style-tint-source.ts` to its reviewed diagnostic Adapter module set. In the retained real production graph, two existing diagnostic routes reach their exact producers and then reach this helper through `program.ts`. The source edge is static and remains subject to the existing producer, reachability, static-closure and route-bypass checks. Unknown modules do not become generally allowed.

The new fixture represents that same transitive `program.ts` edge. Six new negative controls cover two producer kinds, each with a missing program edge, direct route bypass and intermediary route bypass. All original 2,064 controls remain.

| Actual evidence | Result |
| --- | --- |
| New material controls before the checker correction | 2,062 passed / 8 failed / 2,070 total |
| Same 2,070 controls after the one-line correction | 2,070 passed / 0 failed / 0 skipped |
| Original d995 production graph against the old checker | Four original issues, exit 1 |
| Same exact graph against the corrected checker | Zero issues, exit 0 |
| Final GPUI full-admission controls and existing related suites | 29/29, exit 0 |
| Three changed files: Prettier and diff checks | Exit 0 |

The original graph artifact `14837573771` from [run 45216953529](https://github.com/Proto-UI/Proto-UI/actions/runs/45216953529) was downloaded again and verified: ZIP SHA-256 `ee4770712812d43cc730c2abea635c02e121172d981d1ab9089dde190a48a44e`; graph SHA-256 `822cb367cf0eb8addece00c3e97154626530b7a8d3624ca962cdb744ad88c975`. Replaying this retained graph is not a new production build.

## Recovery provenance and remaining acceptance

The executor reset lost the earlier unpublished test-file bytes and raw logs. This recovery does not claim to recreate them from old hashes. The production checker is byte-identical to the earlier intended one-line correction; the two test files are new, explicitly bound reconstructions. A first reconstruction checked the lower-level target operation function; review of that boundary restored the full compiler entry point and reran all 29 tests. Both versions and their actual results remain preserved. The material files did not change between those two reconstructions, so their earlier-in-this-recovery 2,070-control and graph runs remain bound to the same file bytes.

The [complete original recovery archive](evidence/2026-11-23-pr1743-gpui-material-boundaries/raw.tar.gz) is **1,106,189 bytes**, SHA-256 `bb7398b1b029f61bb8d55bbdc42bc9b4f68ba5c1e30e6340837e2eef41c82f98`. It includes both immutable patch packets, original source snapshots and logs, the historical graph ZIP and contents, actual commands/exits, the initial missing-object merge failure and subsequent normal merge receipt. The final three-file packet has SHA-256 `fb04de8e2bb364f8cafd820997b1a2ecb01174d90ca44768ebc4f894aac1c0bb`.

Integration verified all original preimages and all three resulting blobs. Full current-candidate production build, source/type gates, native consumers, strict budgets and final independent PR review remain separate required observations. These focused results do not complete them or erase any earlier failed CI outcome.
