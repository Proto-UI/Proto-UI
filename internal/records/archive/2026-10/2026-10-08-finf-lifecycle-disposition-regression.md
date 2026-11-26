# Lifecycle disposition regression evidence

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Original failures and authority

On [PR #872](https://github.com/Proto-UI/Proto-UI/pull/872), [general job 113396171832](https://github.com/Proto-UI/Proto-UI/actions/runs/37801216346/job/113396171832) failed with `43 !== 11` at `scripts/release/test/lifecycle-readiness.test.mjs:32` (63 passed, 1 failed in the release suite). [Browser job 113396171977](https://github.com/Proto-UI/Proto-UI/actions/runs/37801216346/job/113396171977) also failed the 1440px and 390px return-to-current-version assertions: observed `43 / 735`, expected the historical `/^11 \/ \d+$/` pattern. These failures remain original red evidence.

The tested merge was `0cab5b6f0f0a052d7d70a7920a83e374422db095`, combining head `63a8d4240d8dfc2a36f8cbab367e8a9c43f41fd7` with base `169407b2`. The head and merge have identical lifecycle CLI/test, browser-test, `packages/spec/**`, `spec/**`, authored alpha.1 disposition plan, and Compiler target-profile bytes.

[Release-readiness authority](../../spec/README.md#release-readiness-reports) defines the numerator as draft entities with an authored disposition. The alpha.1 plan has 2 image/release entities, 9 A11y entities, and 32 Field entities introduced with the existing Field family slice: 43 recorded draft dispositions in total. All three slices explicitly say `remain-draft`; all 43 report rows retain `status: draft`, `draftAtVersion: true`, and `stableAtVersion: false`. The catalog has 735 drafts, 692 without a disposition, and zero report issues. Field's contract and test activation blockers remain present. This count establishes neither implementation completion nor admission.

## Bounded correction

The CLI test now independently reads the authored plan and requires its exact entity membership and complete per-row disposition data, the matching summary count, and explicit unchanged draft/non-stable state. Seven mutation controls reject a missing row, missing disposition, extra disposition, incorrect current status, incorrect version status, stable admission, and the old summary count. The scoped success, full-inventory failure and unknown-scope rejection remain checked.

The browser test uses its existing exact current-catalog numerator/denominator oracle when returning from `0.2.0`, as it already does on first load. No UI, producer, spec, disposition, acceptance gate or public target is modified. All four public SSR target profiles were independently read and remain `implemented: false`.

## Validation and remaining work

The unchanged CLI test first reproduced `43 !== 11` locally with Node 24.19.0 and the locked pnpm 10.32.1 dependencies installed into this isolated worktree. The repaired focused CLI/oracle checks pass 9/9, including all seven mutation controls. The existing lifecycle fixture suite passes 90/90; workspace TypeScript passes. The first complete release-suite attempt passed 71/72: its unrelated Tooltip package-build subprocess stopped before its assertions because the direct Node invocation omitted the writable `COREPACK_HOME` cache setting. That environment failure is retained; the same suite is rerun with the existing cache setting, with the final result recorded in the candidate evidence packet.

No local Chromium, remote browser, native pixel or new official CI pass is claimed. Independent candidate review and exact integrated-head CI, including both browser viewports, remain required. No external publication, merge or deployment is part of this isolated repair.
