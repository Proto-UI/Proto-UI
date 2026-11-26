# Compiler scroll-reveal fixture ordering

This is a bounded test-fixture repair and dated observation, not a change to Scroll semantics or an acceptance claim for browser layout. The source baseline is `f29738eb6a804ccfc58510cc5a5bd1692690716e`; measurements were taken on 2026-11-21 UTC with Node 24.22.1, pnpm 10.32.1, Vitest 2.1.9 and Happy DOM 15.11.7.

## Observed failure and owning work

[Shenko Nightly job 136930992702](https://github.com/cyjin-yl/shenko/actions/runs/44932176472/job/136930992702) ran this pin's complete compiler selection: 182 suites passed, one failed and two skipped; 2912 tests passed, one failed and nine skipped. The React ordinary-consumer case rejecting another surface, a sibling, self and another family returned the expected four `rejected/unavailable` outcomes, then observed `scrollTop = 300` where its after-`act` assertion expected 50.

The ordinary fixture enables `endFollow: { mode: 'while-at-end', axis: 'vertical' }`. Its React mounting effects schedule end-follow animation frames. `owner.act` flushes framework work but does not establish that every pending animation frame has completed. The later geometry injection sets `scrollHeight = 400`, `clientHeight = 100` and `scrollTop = 50`.

The diagnostic retained every original test and assertion. It observed real setter calls and scheduled/fired frame identities in the actual emitted helper. A controlled schedule held mounting frames until after all four rejections:

| Observation | Offset before | Offset after | Pending work / result |
| --- | --: | --: | --- |
| Inject request geometry | 0 | 50 | Mount frames remain pending |
| Each of the four invalid requests, synchronous boundary | 50 | 50 | `rejected/unavailable`; no offset write |
| Release the already registered frame #2 | 50 | 300 | Emitted `applyScroll({ kind: 'to-end', axis })` writes the end offset |
| Original after-`act` assertion | 300 | 300 | Fails: expected 50 |

The controlled run reproduced exactly that one failing case: 27 passed, one failed. In the inverse control, mounting frame #2 executed before geometry, writing 0 to 0; geometry then set 50, all four rejections preserved 50 and the valid reveal moved 50 to 70. All 28 original cases passed.

The original CI did not collect setter stacks, so this is a reproduced legal ordering with the same failure, not a replay of its original scheduler trace. The natural observation run completed its frames before geometry and passed. Neither the two unmodified passing runs nor the observation run is a failure-rate estimate.

This matches the existing draft identity/end-follow boundaries and the host test `preserves an older pending end request after an invalid reveal` in `packages/compiler/test/native-scroll-reveal.test.ts`. A rejected reveal must not acquire a movement or cancel independent valid work. The adjacent retained-part fixture already documented this distinction in [the earlier recovery record](./2026-11-17-compiler-scroll-recovery.zh-CN.md).

## Repair

`mountSettledScrollFamily` temporarily captures only animation-frame scheduling while mounting, executes the actual callbacks inside `owner.act`, and continues until the pending queue is empty. Eight rounds bound this fixture; continuing work fails explicitly. It restores both native scheduling functions before returning, so request geometry and the assertions run with ordinary Happy DOM scheduling.

The foreign/self/family rejection case and the existing geometry-invalidation rejection case use that mounting boundary. The second case also has an absolute after-`act` offset oracle after a rejected request; its source shares the same pending-work ambiguity, although it was not the failing CI case. All 29 original `expect` expressions, matcher calls and expected values remain unchanged. There are still seven cases for each of four native-owner profiles: 28 tests, with none added or skipped. End-follow stays enabled, its mounting callbacks execute, and production/compiler/host sources and the lockfile are unchanged.

## Source-bound results

All rows executed the complete original 28-test file with `--maxWorkers=1 --minWorkers=1`; no test-name filter was used.

| Candidate / observation                        | Passed / failed / skipped | Wall seconds |
| ---------------------------------------------- | ------------------------- | -----------: |
| Unmodified pin, run 1                          | 28 / 0 / 0                |       15.511 |
| Unmodified pin, run 2                          | 28 / 0 / 0                |       16.429 |
| Setter/RAF observation, native timing          | 28 / 0 / 0                |       16.594 |
| Mount frames held until after invalid requests | 27 / 1 / 0                |       17.061 |
| Mount frames completed before geometry         | 28 / 0 / 0                |       14.303 |
| Proposed fixture, before formatting            | 28 / 0 / 0                |       15.080 |
| Final formatted fixture                        | 28 / 0 / 0                |       14.504 |

```sh
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/scroll-reveal-consumers.test.ts --maxWorkers=1 --minWorkers=1
corepack pnpm@10.32.1 exec prettier packages/compiler/test/scroll-reveal-consumers.test.ts --check
git diff --check
```

The final tested TypeScript SHA-256 is `3163c6028b4d48b666bbc15deaf216afdf0c74ca269d5cf913d1a0e78789224e`. [Machine evidence](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-compiler-scroll-fixture-order.json) retains run commands, exit codes, before/after selected-input hashes, the original failed assertion, complete React observation excerpts, the diagnostic patch and raw-artifact hashes. Instrumentation adds synchronous trace I/O; controlled-frame runs explicitly inject ordering. The temporary diagnostic is not part of the executable test change.

The full compiler suite, real browser geometry, native upstream CI/DCO and an independent published review remain separate work for the actual submitted revision. The source branch intentionally starts at the downstream pin: observed upstream `main` at `a4583a0873b0b7742171f5b66279204b13f7332e` has unrelated production changes. A downstream pin to this focused fix need not adopt those changes.

## Agent evidence and provenance

Agent paraphrase of the current request: diagnose the fixed compiler failure, retain the original expectations and selection, and repair its fixture without changing runtime behavior or patching a running Nightly. The OpenAI ChatGPT coding agent authored the diagnostic, patch and record using this repository's public MIT source and its existing controlled-frame pattern. No proprietary source was copied. The coordinating agent inspected the helper and assertion preservation; no human review or GitHub approval is claimed. Internal setter/frame traces provide the relevant evidence; a fabricated UI screenshot would not establish this scheduling cause.
