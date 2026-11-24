# Native Contents verification: c3469acc

## Outcome

The exact candidate c3469acc8cc00aff5c49baef2629486d41314aff failed the focused native lane. The two authored native cancellation controls passed. The original public Popover matrix failed its first Shadcn / Web Components runtime-transition poll before the wheel action loop. **Zero public wheel receipts were produced; all 36 expected wheel combinations remain unexecuted in this run.**

- Run: https://github.com/Proto-UI/Proto-UI/actions/runs/45422958374
- Job: https://github.com/Proto-UI/Proto-UI/actions/runs/45422958374/job/138547164722
- Workflow ID: 373828512; event: workflow_dispatch; attempt: 1.
- Run created: 2026-11-24T15:13:18Z; job completed: 2026-11-24T15:22:09Z.
- Controls: 2 executed / 2 passed / 0 skipped. Matrix file: 1 selected test failed / 9 other tests filtered.

## Exact failure boundary

The preserved failure is Error: Matcher did not succeed in 1000ms, at homepage-dogfood.browser.test.ts:1016:81 on the exact candidate. The source statement is:

    await expect.poll(() => root.getAttribute('data-contents-runtime')).toBe(runtime);

The selected matrix case took 46367.902 ms; the file test duration was 135005 ms. This is not the 180-second case timeout. Normal-close observations are empty. No public wheel, retained-after-two-frames offset, keyboard combination or later family/runtime is counted as completed.

The first and late failure snapshots both record contentsRuntime=wc, contentsFamily=shadcn and active generation 1, with preference=null and pageErrors=[]. The late snapshot retains long tasks of 1903 ms, 59 ms and 1941 ms. These are observations after the original check, and do not make the earlier poll pass or establish why it expired. The screenshot shows the mobile header navigation menu open.

This failure occurs before the original +0 wheel assertion. It neither reproduces that assertion nor proves the underlying wheel defect fixed. Any later same-source trial must retain this failed run separately.

### Source-reading correction

The first watcher message expanded a truncated log data-contents-r… as data-contents-ready. Exact source inspection established data-contents-runtime. The earlier ready-assertion wording is withdrawn; original logs and exact source remain authoritative.

## Source and generated-input verification

All 18 declared source files match the exact Git commit in bytes and SHA-256 before and after execution: **36 of 36 checks passed**. Both recorded Git worktrees are clean, source commands succeeded and reported the requested SHA. Nine additional component/observer hashes in the transition receipt also match the same commit. The original artifact ZIP matches the GitHub-provided digest and byte count.

All five actual afterTest generated files match the frozen main8 publication input manifest. Their comparison to old92d is:

| Generated file | Bytes | SHA-256 | Compared with old92d |
| --- | ---: | --- | --- |
| shadcn-theme.css | 6473 | 3de2d4ce2a38e83086128c8863d3391eb74159adde7b1a8b7f450f93fd643f96 | Identical |
| proto-ui-style.css | 294 | 446d2249e0672bdee7ddf77de55c7a8f2140adfb60c41d13ec0183d5f7199d88 | Identical |
| proto-ui-tokens.generated.css | 253817 | 3e37aa92568e1e4ade2d74e228627126e51aa2717824c10bbb3b25f5ea638f7a | Different; matches this candidate’s published inputs |
| proto-ui-shadow-style.generated.js | 642802 | 67e3e6adf39453463137e6f1fb16e58af52c4098d5f5e40a40be0cddaeafb29f | Different; matches this candidate’s published inputs |
| proto-ui-shadow-style.generated.d.ts | 261 | 76d772bac1c5de84e6fb455683513c74c6d40b55de2744caaf3dfc4e4ead94b8 | Identical |

The four absent generated files before harness generation remain recorded as absent; no successful before-generation byte comparison is inferred. The tokens and Shadow JS changes mean this run is not an identical-generated-input comparison with old92d.

## Native controls

The uncancelled control records a trusted wheel with deltaY=400, current dialog/surface identity, unchanged document position and retained offset 0 → 400. The cancelled control records the matching trusted wheel as defaultPrevented=true and offset 0 → 0. Both detect replaced dialog identity and finish without completion errors. These are authored observer controls, not public Popover acceptance.

Runtime: v24.22.3 / Google Chrome 157.0.8103.78. The official CJK preparation and source-retention steps completed successfully.

## Retained evidence

- artifact-14934977971.zip: the original 144382-byte ZIP, 32 file members, SHA-256 f9af0bbdc62f5f3bc6b53dc4b655397bebd9cf83bb0017b7061246c3b64320b7.
- job-138547164722.log and .log.gz: complete connector-decoded UTF-8 job output, 64956 bytes before compression, SHA-256 7bd9a5eb747c65f81f08d56e2ed3775b95319dfd4175145278f676911505a9bb. This is not described as raw HTTP bytes.
- run-final.json, jobs-final.json, artifacts-final.json: final API evidence. Initial/periodic job snapshots and the one bounded queue overview are retained separately. The overview establishes observed repository states, not a cause for scheduling delay.
- result-summary.json, observed-input-and-wheel-checks.json, control-observations.json and wheel-observations.json: derived checks, original selection results, exact failure statement and all 36 unexecuted combinations.
- publication-source-inputs.json: frozen expected source/generated inputs supplied before artifact inspection.
- artifact/runtime/contents-command/shadcn-wc-transition.json and shadcn-wc-failure.png: immediately reviewable extracted failure artifacts. The original ZIP contains both.

The durable bundle contains the original ZIP, complete compressed job log, API snapshots and derived reports. It does not duplicate the extracted PNG/generated tree. No dispatch, rerun, cancellation, platform update or source edit was performed by this watcher.
