# Separate general prerequisites from complete runtime execution

## The first native candidate completed its inventory at the outer deadline

[Run 44930338506, test-general job 136925440826](https://github.com/Proto-UI/Proto-UI/actions/runs/44930338506/job/136925440826) ran source `031d9b661025312244d31506758eed989cc71f94`. Its aggregate execution step was recorded as **cancelled** at the 45-minute job boundary. Finalization and evidence upload succeeded. That cancelled receipt remains authoritative for the job; neither a populated report nor this repair turns it into a successful baseline.

The retained [general artifact 14718479816](https://github.com/Proto-UI/Proto-UI/actions/runs/44930338506/artifacts/14718479816) contains all **21 original command results**, stable clean before/after source snapshots and a complete red runtime report. The [plan artifact 14717626643](https://github.com/Proto-UI/Proto-UI/actions/runs/44930338506/artifacts/14717626643) selects 1,766 general files. The observed report contains those same **1,766 files exactly once**, with no missing, unexpected or duplicate files.

Vitest reports **21,988 passed, 343 failed, 9 skipped and 37 todo assertions**. Its console reports **57 failed, 1,704 passed and 5 skipped files**. Two failed files could not collect tests because the runtime cost fixture was read through a non-file URL. The nine conditional skips come from the existing Dart/Flutter and old-CLI-corpus opt-in paths. Complete inventory therefore describes the evidence coverage; it does not mean every assertion passed or that a collection error executed a test body.

The timing is concrete:

| Segment | Native elapsed time | Result |
| --- | --- | --- |
| First 20 commands | 19m30.343s | 14 passed; 6 failed. |
| Full runtime command | 24m24.884s | Complete red report; exit 1, no child termination signal. |
| Coverage matrix check and its controls | 5m59.300s within the first segment | Passed. |
| Agent-operation checks and controls | 6m02.592s within the first segment | Passed. |
| Release controls | 2m46.949s within the first segment | Failed. |
| Style preset checks | 1m59.676s within the first segment | Passed. |
| Production website build/bundle check | 1m52.914s within the first segment | Failed. |

The first 20 commands began at 17:31:09.475 UTC; runtime began at 17:50:39.818. Runtime was still executing actual files near the deadline: the last file finished at **18:15:03.598**, its terminal checkpoint was written at **18:15:03.928**, and the child closed at **18:15:04.702**. Only approximately **1.104 seconds** separated the last file and child close. The final event stream records the last Drawer diagnostic moving from running to passed. This is not evidence of a long open-handle or output-pipe shutdown hang. GitHub's cancelled step timestamp has only second precision, so this record does not invent the exact signal ordering at that boundary.

The original 343 assertion failures, two collection errors and six prerequisite failures remain available for diagnosis. The preflight failures include the production bundle's two static diagnostic-route imports, stale GPUI generated fixtures and release export expectations; they are not reduced to runner slowness. The accompanying [JSON evidence](2026-11-22-general-ci-scheduling.json) retains command results, artifact hashes, source bindings and the precise runtime counts.

## Bounded scheduling repair

The original plan is partitioned into two `test-general` matrix jobs on independent runners:

- **checks:** the original first 20 commands, in order, including the runtime runner's control tests;
- **runtime:** the original final runtime command, with the complete source-discovered inventory and existing two-worker limit.

Both jobs keep the original **45-minute outer limit**. Each independently installs and identifies the original FFmpeg/Python toolchain and runs the real decoder admission gate. That repeated work establishes each VM's environment; the 21 governed commands themselves remain disjoint and execute exactly once across the two groups. No assertion, test timeout, inventory member or runtime worker count changes in this repair. Matrix `fail-fast` is disabled so a failed prerequisite job cannot cancel the runtime observations.

Each group retains its own plan, command logs, incremental progress and terminal source snapshots. The existing `general` runtime receipt also carries its one-command report; a new `general-checks` slot carries the prerequisite report. The required aggregate retains its existing name and checks both the native matrix result and the latest source-bound receipts. It recomputes the complete original plan, requires the exact commands and arguments in their correct groups, verifies their union exactly once, checks both source snapshots against the candidate, and applies the existing strict runtime inventory/assertion gate. A missing, duplicated, failed, cancelled or source-drifted group cannot be covered by success in the other group or an older attempt.

The native job inventory already preserves jobs by unique ID and does not collapse `test-general` names. A new control confirms that the two matrix jobs remain distinct, including when only one fails.

## Local verification and remaining acceptance

The socket-free Node controls completed with **143 passed, 0 failed, 0 skipped**, covering original command partitioning, missing/duplicate commands, mismatched command arguments, failed and interrupted prerequisite results, later failed attempts, source drift, actual receipt-finalizer/gate CLIs and native matrix-job retention. Independent review also compared the previous 21 commands with the new plan and found identical command IDs, arguments and executables.

No complete runtime suite, native browser or GitHub dispatch was run for this scheduling repair. Its remaining acceptance is the next exact candidate's two native jobs, separate artifacts and aggregate gate. Their observed duration must establish that the new scheduling leaves room for completion; the first candidate's timing is evidence for the partition, not a promise of future performance or a successful baseline.
