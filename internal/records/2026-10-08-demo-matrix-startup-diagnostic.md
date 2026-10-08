# Demo Matrix startup: bounded native diagnosis, not a product repair

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Evidence correction and scope

The original failure is main CI run [37743002077](https://github.com/Proto-UI/Proto-UI/actions/runs/37743002077), browser 8/8, job 113199024212. Its executed checkout is merge `0c2e667957e44abb78408b1d0c37a6b1794b67da`; PR head `0a3fac594103bf1c6fd60fa511ace2e733adb97c` has the same tree `4ccae218a71bb26c65bbd86632dddb4c79f5eeeb`, but was not that job's executed SHA. Artifact 11535965272 retains the phase JSON under `demo-matrix/readiness/`.

All four cases capture 105 demos, 420 initialized previewers and 420 empty hosts at the **start** of the committed-host wait. This is not a terminal empty-host observation. `initPreviewer` sets `inited` and empties the host before awaiting the demo import, so those initial facts do not by themselves identify a bootstrap defect.

Node-side phase-header elapsed seconds from each route-open start:

| Case | Route open passed | Initialized passed | Empty-host wait started | Wait failed |
| --- | --: | --: | --: | --: |
| All adapters | 12.199 | 21.860 | 22.863 | 178.422 |
| 320 px | 16.340 | 25.298 | 26.301 | 182.010 |
| 390 px | 16.233 | 25.047 | 26.050 | 182.350 |
| Base Dialog focus | 16.467 | 25.627 | 26.630 | 179.894 |

The initialized-passed snapshots were unavailable within the diagnostic's 1000 ms limit. The failed-wait snapshots were also unavailable; the last Dialog context was already closed. Headers precede page evaluation and are not exact DOM-sampling timestamps. The original wait reports 60000 ms, while the surrounding phase spans approximately 153–156 seconds. This suggests scheduling/resource investigation; it does not establish a specific stalled function, infinite observer loop, or common root with S2/S4. There is no retained exact-failure PNG in this artifact.

## Local discrimination and rejected shortcut

A temporary synthetic-DOM harness uses actual previewer/renderer code and installed framework adapters, with CDN loaders and website theme resolution substituted. Four Base Button runtimes finish. The full 105 × 4 acquisition does not finish before bounded external timeouts; an initial harness alias omission was corrected, but the corrected run remains incomplete. A WC-only run advances further and also remains incomplete. Neither substitutes for native route evidence.

A Node V8 sample identifies substantial whole-document ID-query work in the A11y registry, plus Anatomy notifications and scalar-attribute projection. An exact-ID-selector experiment does **not** make the same full-matrix probe finish within its bound. It was reverted. No A11y, material observer, bootstrap batching, runtime eagerness, stylesheet, readiness predicate, or deadline change is proposed from these observations. The candidate Card/startup tree `9e00cdea8` does not modify Matrix/previewer bootstrap/rendering; its surrounding startup changes still require exact-new-head evidence.

## Diagnostic increment

`PROTO_UI_MATRIX_STARTUP_PROFILE=1`, an evidence directory, and the original all-adapters case name are all required. Ordinary CI remains unprofiled. The dedicated `Demo Matrix startup diagnostic` workflow selects only that representative original case on the exact PR head; the other three cases remain in the standard runtime plan. A skipped case is not a passing case.

The Node-side collector starts Chrome's sampling profiler before navigation, samples every 10 ms, and requests a stop after a 45-second diagnostic window. It persists phase-labelled heartbeat receipts every five seconds and caps each CDP operation/write wait at two seconds. CPU setup/stop failures become explicit unavailable receipts; they neither replace the original failure nor make readiness pass. The requested window and actual elapsed/profile timestamps remain separate when scheduling delays the timer. Cleanup is idempotent and unsubscribes network listeners.

Network evidence records same-origin resource paths, aggregate request/response/completion/failure counts, status counts and at most 200 pending/failure rows. It never reads headers, bodies, account state or page input. Queries, fragments and credentials are stripped; non-HTTP CPU-frame URL payloads are omitted. The collector does not evaluate/mutate DOM, route requests, inject input, or implement its own readiness test.

## Validation and remaining gate

- 14 collector/gating controls and the existing eight Matrix observation tests pass. Controls exercise default-off behavior, exact representative-case gating, bounded retention, the 45-second stop, idempotent cleanup, rejected and never-settling CDP commands, and preservation of the original thrown readiness error.
- TypeScript validation of the collector and its tests passes; YAML parsing and whitespace checks pass.
- AST comparison against `0a3fac594` preserves all 43 acceptance expressions and case-budget declarations, including both original 60-second waits and the original 180-second case deadlines.
- No new local Chromium execution or native result is claimed. The existing local browser capability restriction was respected.

The parent must independently review and publish this separate diagnostic commit, then inspect the official exact-head profile, network receipts and original failure together. Sampling overhead is never performance acceptance. Once a source cause has a discriminating repair, rerun the complete original unprofiled Matrix suite. S2/S4 and other CI failures retain their own evidence requirements.
