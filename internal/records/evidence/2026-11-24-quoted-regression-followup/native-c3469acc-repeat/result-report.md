# Native Contents verification: same-source c346 repeat

## Outcome

The separately dispatched repeat on c3469acc8cc00aff5c49baef2629486d41314aff completed the exact focused lane successfully: **two native cancellation controls and all 36 public wheel combinations passed**. Each public receipt records final offset 0 → 500 after the original two-animation-frame retention check, a matching trusted uncancelled wheel, current dialog/surface identity and unchanged document scroll.

- Run: https://github.com/Proto-UI/Proto-UI/actions/runs/45425876105
- Job: https://github.com/Proto-UI/Proto-UI/actions/runs/45425876105/job/138557613678
- Workflow ID: 373828512; event: workflow_dispatch; attempt: 1.
- Created: 2026-11-24T15:28:16Z; job completed: 2026-11-24T15:32:41Z.
- Controls: 2 executed / 2 passed / 0 skipped. Original matrix: 1 selected test passed / 9 other homepage tests filtered.
- Matrix case: 127604.029711 ms, within its original 180000 ms deadline. File test duration: 195573 ms; Vitest invocation: 196.21 seconds. The larger file/invocation times include setup and are not case timeouts.

## Actual public matrix

Every cell below represents click, Enter and Space: three distinct saved wheel receipts. No combination is missing, duplicated or substituted.

| Family | Web Components | React | Vue | Vue 2 |
| --- | --- | --- | --- | --- |
| Shadcn | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 |
| Brutalist | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 |
| Bootstrap 2/3/2 | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 |

All 36 original 1000 ms wheel deadlines are retained in the receipts. The final offsets remain nonzero and in the input direction after two animation frames. All before/after readiness, visibility, positioning, connection, identity and hit-in-content fields are true; no observer/chain scroll records were dropped. No opt-in positioning-decision trace is present.

The previously failing Brutalist / Web Components / click receipt records 0 → 500, clientHeight 768 → 772 and availableHeight 772 → 776, with one observed trusted scroll to 500 and no later reset in its retained observation window. The other 35 receipts also finish at 500. This states the recorded window, not an indefinite guarantee.

The artifact additionally contains 36 normal-close observations with the original home-inserted / sibling / marker-removal sequence, 12 keyboard-focus receipts with completed screenshots, 12 public-open records and 12 runtime-transition receipts without original errors.

## Source and input closure

All 18 declared source files match exact Git bytes and SHA-256 before and after the tests: **36 of 36 source checks passed**. Both Git status records are clean and report the requested SHA. All 73 public JSON records bind to the same source and clean state; their nine distinct component/observer hashes also match the candidate.

All five actual generated afterTest outputs match both the pre-publication main8 input manifest and the first c346 run byte-for-byte:

| Generated file | Bytes | SHA-256 | Compared with old92d |
| --- | ---: | --- | --- |
| shadcn-theme.css | 6473 | 3de2d4ce2a38e83086128c8863d3391eb74159adde7b1a8b7f450f93fd643f96 | Identical |
| proto-ui-style.css | 294 | 446d2249e0672bdee7ddf77de55c7a8f2140adfb60c41d13ec0183d5f7199d88 | Identical |
| proto-ui-tokens.generated.css | 253817 | 3e37aa92568e1e4ade2d74e228627126e51aa2717824c10bbb3b25f5ea638f7a | Different |
| proto-ui-shadow-style.generated.js | 642802 | 67e3e6adf39453463137e6f1fb16e58af52c4098d5f5e40a40be0cddaeafb29f | Different |
| proto-ui-shadow-style.generated.d.ts | 261 | 76d772bac1c5de84e6fb455683513c74c6d40b55de2744caaf3dfc4e4ead94b8 | Identical |

Four generated files are correctly recorded as absent before harness generation. No successful before-generation comparison is inferred for those absent outputs. Tokens and Shadow JS differ from old92d, so this is not an identical-generated-input experiment against the old failing source.

## First same-source failure remains retained

The first c346 run, https://github.com/Proto-UI/Proto-UI/actions/runs/45422958374, failed its initial Shadcn / Web Components data-contents-runtime poll in 1000 ms before any public wheel action. Its original ZIP, complete job log, transition snapshot and screenshot remain archived separately. This successful repeat does not erase that failure or establish why its runtime-transition poll expired.

The runner IDs differ: first 1000120816, repeat 1000120830. No same-machine equivalence is claimed. This repeat records v24.22.3, Google Chrome 157.0.8103.78, linux/x64, kernel 7.0.0-1014-aws.

## Native controls

The uncancelled oracle control records a trusted wheel with deltaY=400 and offset 0 → 400; the cancelled oracle records defaultPrevented=true and offset 0 → 0. Both retain the current dialog/surface and document scroll during the action, reject replaced dialog identity, and finish without completion errors. These authored controls validate the observer boundary; the 36 separate public receipts establish this lane’s public matrix coverage.

## Retained evidence

- Original ZIP artifact-14936737832.zip: 1699009 bytes, 126 file members; GitHub digest matched SHA-256 25d4638caf094827be04796da75545aab447be63000907305a5e67bfb87f7ef0.
- Full job log: job-138557613678.log and lossless .log.gz. Complete connector-decoded UTF-8 is 63024 bytes, SHA-256 2d33d5dca3d8620e51d8aec3f60c7a283e95e8d4995f5184b45a01e4dfac2d0d. It is not described as raw HTTP bytes.
- Final run/jobs/artifacts API responses, initial and periodic job snapshots, frozen publication inputs and file digest manifest.
- result-summary.json: complete source/environment, generated inputs, scope, controls and timing checks.
- wheel-observations.json: all 36 actual combinations, offsets, dimensions and trusted wheel/scroll records.
- completion-observations.json: normal-close, keyboard-focus, public-open and runtime-transition evidence.
- Extracted artifact/runtime/contents-command/brutalist-wc-click-wheel.json is the direct counterpart of the earlier failing combination; all original images remain in the ZIP.

The compact durable bundle keeps the original ZIP, complete compressed log, API responses and derived reports without duplicating the extracted PNG/generated tree. This success is the exact focused lane; it is not complete homepage/full CI acceptance or platform approval. No extra dispatch, rerun, cancellation, platform mutation or source edit was performed by this watcher.
