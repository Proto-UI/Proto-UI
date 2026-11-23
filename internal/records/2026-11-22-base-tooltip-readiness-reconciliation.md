# Base Tooltip public-consumer readiness reconciliation

This repairs the entry premise of the Sprint 3 [#1455](https://github.com/Proto-UI/Proto-UI/issues/1455) public documentation consumer. It does not change Tooltip or Adapter behavior, and native revalidation remains pending.

## Original observation

Full CI [job 137199303898](https://github.com/Proto-UI/Proto-UI/actions/runs/45018250847/job/137199303898) used `830287f95959a4a1a4fb797df68b0bd6889e0bae`. The shard ended with 43 passed and 4 failed tests. All four failures belong to the eight Base Tooltip cases: EN/ZH React failed on initial entry, and EN/ZH WC failed only when replacing the live WC owner with React. The original 20,000 ms `waitForRuntimeAt` limit expired in each case.

The native JSON reports retain zero page errors. The WC cases already recorded focus description, native Tab to the sibling and Escape clearing the description before the failed React replacement. The Vue and Vue 2 cases passed their complete journey and replacement with WC. The original reports identify Chromium `157.0.8103.78`. This is more specific than a four-host startup failure.

The downloaded browser-11 artifact is retained at `/workspace/scratch/828b7e591003/s3-tooltip-ci-diagnosis/runtime-browser11.zip`, SHA-256 `83b0642b7574aab9d24738823fc9f32e3c88aeb36a76905c72aaccb081520052`. Its original eight JSON receipts and four captured screenshots remain in that archive. The failed suite, shared readiness predicate and actual Base recipe were unchanged between that CI source and the repair's parent `369a30f2da11b61bfca82688123391e574594fa4`.

## Cause and bounded repair

A separate DOM diagnostic instantiated the actual `initPreviewer`, original Base Tooltip recipe, website-pinned React/ReactDOM 18.3.1 and real Adapters. It executed the original readiness predicate without injecting framework, runtime or ownership markers:

| Closed consumer | Physical roots inside its actual surface | Actual focus Triggers | Original seven-root readiness | Two-Trigger readiness |
| --- | --: | --: | --- | --- |
| WC | 7 | 2 | true | true |
| React | 5 | 2 | false | true |

React had committed the requested runtime and real mounted framework ownership. Its closed Contents did not yet have physical nodes, so the universal seven-root premise rejected a usable consumer. The physical-node count is an observation of this candidate, not a new cross-framework guarantee.

Only the two Base Tooltip native call sites now use the same `[data-pui-root][tabindex="0"]` selector already used by the business journey, requiring exactly two subjects. The existing unique Account and Notifications checks, actual description/Content assertions, Tab, Shift+Tab, Escape, replacement-owner disconnection and portal cleanup are preserved. The shared helper is unchanged: it still checks the unique previewer, host and passive surface, public committed runtime, selected runtime control, actual framework ownership, startup state, inert/hidden ancestors and containment. The 20,000 ms limit is unchanged. Focusable-node counting alone is not treated as proof of Tooltip behavior; the subsequent native assertions remain required.

## Candidate evidence

The new `demo-base-tooltip-readiness.test.ts` mounts the real producer for WC, React, Vue and Vue 2. It retains the original React seven-root counterexample and rejects a detached actual Trigger, an additional copied-looking focus subject and an inert host, restoring the same producer between controls. No native input, paint or accessibility result is inferred from these happy-dom controls.

The focused run used Node `24.22.3`, a 512 MiB heap, one worker and both shared validation locks. It finished **4 passed, 0 failed, 0 skipped, exit 0**, in 7.29 seconds. The 90-second execution cap was not reached. The earlier two-host diagnostic also exited 0 in 5.63 seconds; its purpose was cause isolation.

```sh
env NODE_OPTIONS=--max-old-space-size=512 node node_modules/vitest/vitest.mjs run apps/www/src/content/docs/zh-cn/demo-base-tooltip-readiness.test.ts --maxWorkers 1 --minWorkers 1 --fileParallelism false
```

Raw evidence lives under `/workspace/scratch/828b7e591003/s3-tooltip-native-entry-evidence/`:

- `base-readiness-diagnostic.test.ts`: retained executed diagnostic source, SHA-256 `8c978955f0781d71bed9ae767ead65a868f423e81ea1c0fc69d86b7da4c85def`.
- `base-readiness-diagnostic.json`: actual structure, predicates and DOM, SHA-256 `4a5266132105ddd64414aecf807dd08a0fae8fa1c1fd0e3575664399b896ca88`.
- `base-readiness-fixed.log`: the focused four-host terminal log, SHA-256 `8b31f54e533d93c8773ab355e865953c01b42d468fec9adaeaf7211570c67b7c`.
- `base-readiness-diagnostic.log` and `base-tooltip-ci-job-137199303898.log`: separate diagnostic and original CI terminal logs.

The original four native failures remain failures. The next acceptance step is the unchanged eight-case browser journey on the repaired source. The separate [warm-handoff support-list correction](2026-11-22-tooltip-handoff-runtime-admission.md) addresses another prerequisite and does not supply this browser result.
