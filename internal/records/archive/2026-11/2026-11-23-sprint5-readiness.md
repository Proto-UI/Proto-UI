# Sprint 5 readiness continuation — 2026-11-23

This record is implementation evidence, not a normative definition or a release acceptance decision. Codex continued PR #1715 under the current user's instruction to finish the remaining Sprint 5 work and reach a genuinely reviewable candidate. No CI, independent approval, DCO, contribution-rights or repository-rule exception was requested or used.

## Candidate composition

The public starting head was `c356497c86beecda03dc8a400065d60314256742`. Main was fixed at `b715b8a6d08c2c79417272c8d4ca9254984feadb`. The preserved implementation head before the changes in this record is `4beddd833ec1aea041be3c2e57f102136e5ecb09`, tree `dc5a1cb35a4d148af067c57bd4eab648fe22e1cf`.

- `0b6c1de846822e7b0e7289b56d0cbb29cce9fe70` merges main while retaining ControlLabel leases, UTF-16 values, native callable identity, authored renderer capture, event notifications and both native acceptance routes. Numeric accessibility ActionData travels through the same current action lease before dispatch. An accepted current hover leave cancels pending label activation; stale epoch/window/hitbox leaves cannot cancel a new turn.
- `b2b89f1a` applies the production module-Worker and repository-root repair from `a7fc2e9688cb0a47db52d6e77c9da52f4a19b007`, with the configuration receipt adapted to this Sprint 5 branch rather than importing unrelated Sprint 4 configuration.
- `6c4343ab` preserves the strict capture-pixel repair from `b7a74b283457ab4aead315158559f4adc7f5d8a9`. The existing native screenshot thresholds, regions and negative controls are unchanged.
- `4beddd833ec1aea041be3c2e57f102136e5ecb09` applies the independently prepared browser-retirement repair from `6d090b415f9d96f0e19ceddeba3a4f407476adf1`. An iframe must acknowledge cleanup; a missing acknowledgement rejects after 250 ms while listeners, timers and the frame are reclaimed. A panel retains outstanding or failed retirement across close, reopen, failure and disconnect.

The follow-up changes correct the Button SSR cyclic-data assertion to the actual `TypeError` contract, and add a bounded manual validation entry point. The existing registered compiler-native workflow accepts optional `browser_acceptance=true`. It calls the same revision's browser workflow, independently of native results, with source regressions and the production build explicitly enabled. Those two additional jobs default to false for existing callers so the full production cycle does not duplicate its other source/build lanes. No automatic push/PR trigger, write permission or cancellation policy was added.

## Exact configuration boundary

The Sprint 5 Astro configuration SHA-256 is `a9eeed0952291e3226c09f1a974dc0742472df8079240210afdbc3701db5dfa3`. The previous reviewed profile remains recognized. This additional exact profile adds three lazy QuickJS dependency exclusions and ES module Worker output; the four Retry import owners and their helpers remain bound. It does not admit general bare-package promotion. The broader integration configuration's hash is not substituted for this branch's actual bytes.

## Executed evidence

The recovery checks below ran with Node `v24.22.3` and pnpm `10.32.1`. Frozen offline installation reused all 586 dependencies and downloaded none.

| Scope | Actual terminal result | Binding and limitation |
| --- | --- | --- |
| Button SSR server | 8/8, exit 0 | Corrected test on the preserved implementation; includes strict type checking of the emitted server/client/helper closure |
| Exact Retry configuration controls | 45/45, exit 0 | Current Astro bytes and current/historical helper, mutation, symlink and directory controls |
| Repository-root, delivery receipt and CI controls | 58/58, exit 0 | Actual relocated source graph, foreign-directory refusal, delivery provenance and scheduling/inventory/receipt tests |
| New workflow and SSR test formatting | Passed | Prettier 3.8.1; three changed files |
| CI schedule and scoped whitespace checks | Passed | No push triggers; existing single regression owner and guarded contexts retained |

Compressed raw output and the complete Button JSON result are under `internal/records/evidence/2026-11-23-sprint5-readiness/`. The corrected Button test SHA-256 is `ceda8f1121b2edce4c5a5f679cea47a63003393dc91cccc5b40673c6b2695a4d`.

Earlier local evidence is preserved separately: 193 request/owner cases, 128 native-source cases, and 17 browser-retirement/session cases actually passed. Those are historical executions, not new results for an unexecuted final head. The new CI source lane repeats the affected tests on its recorded candidate. The prior Button test attempts included SIGKILL, pending assertions and a real obsolete `/portable/` expectation failure; none of those attempts is relabeled as a pass. The complete subsequent 8/8 result supersedes that verification gap.

## Remaining acceptance at publication

The candidate requires current-head CI before a readiness decision:

1. Dispatch `compiler-gpui-source-consumers.yml` on the Sprint 5 branch with both `adapter_acceptance=true` and `browser_acceptance=true`.
2. Inspect the independent Linux/macOS generated-native consumers, emitted SDK lifecycle/control regressions, macOS Adapter/AccessKit/capture results, real bilingual browser journey, source tests/types and production website build.
3. Read actual artifact source identifiers and visual content. A skipped optional job, an old passing run, file creation alone or a local review is insufficient.
4. Reconcile independent findings, current DCO/status/review/thread state, PR description and earned Issue children before marking ready.

The browser inventory still migrates only the two demonstrated Base Button pages and four Web targets. The ten original Issues (#1144, #1056, #687, #828, #1169, #1170, #1171, #1172, #895, #896) keep their original conditions. Full application consumers, remaining page combinations, physical assistive-technology acceptance, GPUI-on-WASM and additional native backends are not inferred from these results.

Request/owner definitions and their complete-target-initialization implementation remain draft/missing where recorded. The private four-target generated-server evidence and the bounded WC Button experiment do not admit public SSR; `PUI4001` remains the canonical public refusal.

## Recovery provenance

The execution environment was interrupted after the implementation commits were created. A verified Git bundle preserved all four commits and their two public prerequisites; the original head/tree were recovered unchanged. Alternative device worktrees were isolated and were never published. One intermediate device reconstruction produced an invalid local conflict-marker commit after a failed guard; it was rejected as a candidate, and no bytes from it entered this branch. The recovered original Git objects, not that reconstruction, are the source of this continuation. Resource interruptions and the original failed controls remain historical evidence.
