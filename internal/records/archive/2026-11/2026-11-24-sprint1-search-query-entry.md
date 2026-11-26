# Sprint 1: bounded Retry handoff after delayed query entry

This is a followup to the real `0b0b861bf18a18d20aa2f0e627ba477dbab463e5` Shadcn production failure. It adds a reproduced public-state ordering repair and source-host controls. It does not relabel the old production failure as passed or claim native acceptance of the new candidate.

## Original native result

Sprint 1 run `45249497810`, artifact `14858665505`, preserves the original HEAD503 failure under the original **1,000ms** matcher. The Shadcn Dialog was visible, its query was empty and connected, and one Pagefind HEAD request returned 503. The retained focus timeline contains opener-to-query focus, with no Retry focus event. Its final active element was the input. The screenshot shows the presented error/action region; it does not independently certify focus or typography.

The full downloaded artifact SHA-256 is `2a4ff79729755411164b9e1e99c1a68d32dea3efd88b704909bfc37de27f942a`. This record's receipt archive includes the unmodified production step receipt, Shadcn failure JSON and PNG. The successful Brutalist successor and other Search journeys remain attached to their own original evidence.

## Reproduced missing ordering

The existing repair waits for panel presentation, retries on panel transitions, and accepts a handoff only when the current Retry control reports its own focused state. A separate order remained possible: the panel's last transition and both author-slot commits finish before the input's actual public `focused` fact becomes true. An initially refused Retry call then has no later panel, Session or instance-identity signal to retry it.

Two independent cases exercise that order for Shadcn and Brutalist without manually calling paint after the query fact. They both failed on the unchanged composition. The same red run included current-query replacement and synchronous subscription replacement controls: **36 passed / 4 failed / 0 skipped**, across the original 33 and seven new cases. This establishes the public ordering gap. The exact source of the original Chromium race still requires a native successor on the repaired candidate.

## Repair and limits

The composition subscribes to the **current query public instance's** exposed `focused` State. A real `next: true` can request one additional normal paint per opening. The opening records that request before dispatch, so duplicate notifications or reentry cannot create a retry loop. No polling, timer, longer matcher or direct DOM focus was added.

The normal paint retains its original guards: current generation, open state, latest paint epoch, current committed author boxes, current action identity, panel presentation, empty startup query, automatic-entry policy and the original focus-epoch allowance. A later user focus choice or edited query cannot be reclaimed by the new signal. The current Retry control's actual public focus fact still proves completion.

The subscription reserves its identity before invoking public code. Replacement retires the old registration first; synchronous replacement, disposal or terminal disconnect during registration releases the returned disposer. Terminal owners remain tombstones until a new public identity arrives, preventing unrelated panel notifications from reading disconnected facts. An already-delivering old callback cannot read or repaint through the successor. Final composition cleanup retires the current subscription along with the existing resources.

The shared Command input definition already publicly exposes `focused` from its Focus module. The observer consumes that fact through the normal public instance API. It does not synthesize focus state or add a private renderer dependency. Non-Shadcn public-identity subscriptions now include `query` so the same ownership rule applies there.

## Complete executions and the incomplete attempt

| Execution | Outcome | Disposition |
| --- | --- | --- |
| Original composition + seven new controls | 36 passed / 4 failed / 0 skipped | Retained red evidence |
| First repaired candidate: both full files | 65/65, exit 0 | Complete, before the last two cleanup controls were added |
| Candidate + two registration cleanup controls: combined invocation | Exit 1; 46 assertions passed and 21 remained pending | **Incomplete, not accepted** |
| Final existing real four-host composition file alone | 25/25, exit 0, 0 skipped | Complete |
| Final publication/ownership control file alone | 42/42, exit 0, 0 skipped | Complete |

The incomplete invocation emitted `Some tests are still running when generating the JSON report`. Its JSON misleadingly reported `success: true` and one pending test while the individual assertions contained 21 pending cases. No worker exception or signal cause was present in its log. The integration owner confirmed there was no intervening commit, stash or process stop. The full original receipt remains in the archive, and the two complete successor invocations are reported separately rather than converting that run into a green result.

Final distinct coverage is **67 successful cases across two exit-0 invocations**: the original 33 publication/ownership cases, nine new ordering and cleanup controls, and 25 existing composition cases. The existing composition suite uses actual prototype loaders, adapters and four frameworks in synthetic DOM; the control file uses deterministic public API boundaries. Neither is native Chromium. The normal case/suite budgets are unchanged.

Both final commands use:

```sh
node node_modules/vitest/vitest.mjs run <full-file> \
  --maxWorkers=1 --minWorkers=1 --reporter=json --outputFile=<receipt.json>
```

The full files are `apps/www/src/components/site-search-composition-paint-cost.test.ts` and `apps/www/src/components/site-search-composition.test.ts`. The final control receipt includes before/after hashes and exit code; all three directly affected source/test files remained identical during that invocation. The candidate composition SHA-256 is `be005c38f2d2a231d408e68a47febf924132fb1d80f8133d2576c4a979140c15`.

## Deliverable and remaining native acceptance

An independent source review of the final composition hash and all nine new controls found no blocking issue in this bounded change. The reviewer checked identity reservation before subscription, old-disposer reentry, terminal tombstones, immediate cleanup after synchronous registration-time replacement/disposal/disconnect, existing paint and user-intent guards, and the distinction between a request and actual focus acceptance. The reviewer read the executions but did not rerun them. This is an independent agent source review, not a GitHub approval or completion of the original owner's whole acceptance matrix.

The [manifest](evidence/2026-11-24-sprint1-search-query-entry/manifest.json) preserves exact source/test snapshots, all five execution stages, the incomplete-run discrepancy and original native provenance. The [receipt archive](evidence/2026-11-24-sprint1-search-query-entry/receipts.zip) has 23 members, 260,352 bytes, SHA-256 `9cde65cd3061bb3a7849c2e4db3ed9c492cb79e7eef10446ec76e01cc66e6d02`; every member and ZIP CRC was read back.

The new composition still needs the original production Retry recovery journey within 1,000ms and the affected native disposal acceptance on its actual integrated source. The earlier 0b E retirement results remain valid for their original scope and source; adding this observer does not silently reuse them as proof of the new subscription's native cleanup. No complete #848, #1178 or #1488 closure is inferred from these bounded results.
