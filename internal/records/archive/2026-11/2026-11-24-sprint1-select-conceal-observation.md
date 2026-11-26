# Sprint 1: Select intent marker and two-frame retirement evidence

This non-normative record reconciles the three actual Select assertion failures in [Sprint 1 run 45238345986](https://github.com/Proto-UI/Proto-UI/actions/runs/45238345986), source `81c103bd462b73910f7279122fab5f282d172d56`. Its original focused-unit result remains **599/602 passed, three failed, zero pending**, process exit 1. The original receipt, report and complete focused-unit log are retained; this correction does not relabel that run as green.

## Existing meaning and the incorrect observation

[C-HOST-VIEW-ATTACHMENT-0001-B](../../../../spec/contracts/C-HOST-VIEW-ATTACHMENT-0001.yaml) says that `data-pui-view-detached` is present exactly when the instance's view intent is not present. The contract remains **draft**, with the existing `0.3.0-alpha.0` revision. [T-HOST-VIEW-ATTACHMENT-0001-CASE-INTENT-EXACTNESS](../../../../spec/tests/T-HOST-VIEW-ATTACHMENT-0001.yaml) maps that distinction to executable tests. This change neither activates that entity nor changes its meaning.

The adapter projects not-present intent immediately, then separately waits for the existing two rendering opportunities before detaching the mounted view epoch and returning the portaled Content to its author parent. The three Select assertions instead expected the intent marker to remain absent after the first frame. That conflated the marker's declared meaning with physical retirement. The [2026-11-23 Portal assertion correction](2026-11-23-portal-conceal-assertion-correction.md) already documented the same distinction for Dialog and preserved its original red evidence.

The exact original Base, Brutalist and Shadcn Select test files, adapter source, conceal source and frame helper were byte-identical to the corresponding `81c103bd` files before the local replay. Replaying the three complete Select suites in the current shared working tree reproduced **46/49 passed, the same three assertions failed, zero pending**, process exit 1. This is a bounded replay of those unchanged inputs, not a full clean-checkout reproduction of every dependency in the original workflow.

## Test-only correction and stronger retirement observations

Only these three executable test files change:

- `packages/prototypes/base/test/select.test.ts`
- `packages/prototypes/brutalist/test/select.test.ts`
- `packages/prototypes/shadcn/test/select.test.ts`

Each case now checks the marker immediately after semantic closure, after the first rendering opportunity and after the second: it is present at all three points. Physical retirement is observed separately: Content stays under `document.body` through the first opportunity and returns to its exact original Root after the second.

Each fixture adapts the unchanged authored Content prototype under a fixture-local tag so its existing public diagnostic callback has a private sink. No prototype wrapper or replacement implementation is introduced. The trace must contain exactly one `mount.mounted` epoch while open and must remain unchanged through semantic closure and the first frame. The second frame must add `unmount.begin` and `unmount.done` for that same epoch. A replacement mount or instance disposal would also fail the exact trace. The other canonical-tag cases in all three complete suites remain in place.

The original two `frame()` calls, nonzero delivered-callback assertions, helper's eight microtask flushes, positioning and style assertions, and Brutalist's 150 ms enter / 100 ms leave clocks are unchanged. Shadcn's existing animation cleanup and subsequent 100 ms observation remain. The adapter, Portal implementation and frame helper are unchanged; their before/after hashes are included in the evidence.

## Execution and negative controls

All local runs use Node `v24.22.3`, Vitest `2.1.9`, happy-dom `15.11.7`, and `--no-file-parallelism`. Every result below has zero pending cases.

| Execution | Actual result | Observation |
| --- | --- | --- |
| Original complete Select suites | 46 passed / 3 failed, exit 1 | Original first-frame marker assertions reject the actual `true` marker. |
| Intermediate parent-only correction plus existing Portal suite | 67 passed / 0 failed, exit 0 | Retained as an intermediate result, before the final epoch assertions. |
| Final three Select suites plus unchanged 18-case Portal conceal suite | 67 passed / 0 failed, exit 0 | Immediate intent marker; exact parent and same-epoch retirement after two frames. |
| One-frame retirement mutation, three complete Select suites | 46 passed / 3 failed, exit 1 | All three target cases reject Content already returned to Root after the first frame. |
| Three-frame retirement mutation, three complete Select suites | 46 passed / 3 failed, exit 1 | All three target cases reject Content still under `body` after the second frame. |
| Delayed-intent-marker mutation, three complete Select suites | 46 passed / 3 failed, exit 1 | All three target cases reject the absent marker immediately after closed intent. |

Each mutation is applied only to the Vite transform's in-memory source. The shared product files are never overwritten. The configs verify the expected original source fragment count before replacing it and save the complete transformed source. Thus an unapplied mutation cannot be mistaken for a useful negative control. Full reports and logs, exact commands, original and candidate source snapshots, transformed sources and their hashes are retained.

The unchanged Portal suite additionally retains its existing two-frame, cancellation, visibility, reconnection and Dialog owner-cleanup controls. These results are local DOM and lifecycle evidence. They do not prove compositor paint, physical input, native-browser behavior or AT, and do not complete #1178's full regression or #1156's remaining integration acceptance.

## Source and evidence carrier

[Evidence manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint1-select-conceal-observation/manifest.json) and [raw evidence archive](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint1-select-conceal-observation/raw-evidence.zip) preserve the source-bound results. The ZIP is 341,397 bytes, SHA-256 `e99a3a2c7d802525bb776ff2adf1d3fbf9a6b7be1d45a2b12b3fe9bbcccb5894`; all 46 entries pass CRC and every payload size and SHA-256 was read back and verified.

The official full S1 archive is separately retained with its original 21,119,611 bytes and SHA-256 `c60ceb72c2eb96328a687f0f3426d0977441ead390ef2a0051f523a3e8bdcdb4`; this carrier includes its focused-unit subset, not unrelated screenshots or artifacts. Candidate source snapshots name shared checkout `333f2b19cc7bbe52deab3999f7beef34f6845304` plus the dirty source files actually exercised. They are not a clean-head CI result.

Independent review and final integrated CI remain separate receipts; no GitHub approval or workflow pass is asserted by this record.
