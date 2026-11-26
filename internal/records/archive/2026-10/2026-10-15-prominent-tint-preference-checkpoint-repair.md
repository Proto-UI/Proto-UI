# Prominent tint preference probe and terminal evidence repair

## Scope and historical evidence

This bounded test-only repair starts at PR #887 commit `121e780faf919e0bfbd0c487eb59b7bd6b35556a`, tree `18b1672c12aad414929a94c19de697648f010bbf`. The original native outcome remains: **40 failed / 8 passed** across four Web runtimes. The historical results and artifacts are not rewritten or reclassified as passing.

All sixteen preference cases executed and reached the fifth captured stage (`4-unknown-motion-before-held`) before the synthetic unknown-motion call stalled. Stage 5 (`synthetic-unknown-motion-held`) and later captures did not execute. Historical `results.json` left each preference case `running`; the terminal checkpoint incorrectly called it `blocked-at-normal-finalization`.

## Cause and bounded correction

The synthetic `matchMedia` probe dispatched `change` across its live records array for every query. The actual scene resolution listener removes its old subscription and registers a fresh resolution query on each event. Dispatching the synthetic preference event to that listener continuously appended new records to the same iteration.

The extracted test-only initializer now snapshots the records and computes the effective-match delta before dispatch. Only changed queries receive events, including restoration of the previous unknown feature. Resolution and color-scheme queries are unaffected. A changed preference listener may register a new query without extending the current dispatch. Existing native change forwarding remains intact.

Vitest 2.1.9 races its timeout against the case promise; it does not reject the case body's pending await. A runner failure hook now records the failure before asynchronous persistence, latches it, and prevents late case completion from publishing a pass. Active captures are marked interrupted; untouched captures remain not-run until normal terminal blocking. Capture updates and journey-success bookkeeping reject late updates from a failed/finalized case. The checkpoint and final results use the same terminal reconciliation: unresolved executed work is interrupted, and only unexecuted work is blocked.

No production preference provider, scene resolution listener, source guard, shader, material projection, metric threshold, or native assertion is changed. Both 120-second case deadlines, the 48-case/1,608-capture plan, and all original native assertion expressions remain intact.

## Verification and limits

A bounded baseline reproduction detects live-array registration growth after 16 registrations instead of hanging indefinitely. The original case accounting remains running after an external timeout and later becomes completed when its body resolves. Initial discriminating regressions reproduce seven failures with eight passing controls.

An isolated Vitest timeout test intentionally fails at 25 ms. Its retained result verifies failed case accounting, preserved stage-4 observations, unexecuted stage 5 and rejection of late success. This is runner evidence; the native case deadlines remain unchanged.

Timeout can also occur while the last capture checkpoint, summary write or context cleanup is pending. The corrected implementation checks case activity after both checkpoint awaits. Journey and preference summaries describe `observations-collected` with `terminal: false` and point to Vitest plus per-case coverage for the terminal outcome. A summary written before cleanup therefore cannot claim a terminal pass.

The seven prominent-tint unit suites pass 98/98, including 43 harness/fixture/metric regressions. Targeted strict TypeScript, 65 workflow-input regressions, formatting and exact-source assertion/plan checks pass. Tests include initializer serialization, restoration, native change forwarding, late resolve/reject, capture-checkpoint interruption and summary/cleanup timeout.

The CI command includes the new harness test, and both helper and test are covered by workflow input checks. Fresh exact-head native CI remains required. Local test success does not resolve existing optical/contrast failures or establish visual acceptance. The original failures and interrupted evidence remain historical results.
