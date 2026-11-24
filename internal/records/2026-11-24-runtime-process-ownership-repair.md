# Runtime runner process ownership repair

The release audit identified a source-level cleanup gap on main `248f8270dd3458d1fcbc507e618337f98b9fde96`. The old `stopServer()` returned when the Astro leader had exited. After sending TERM it waited only for that leader, so a surviving descendant did not receive KILL. Vitest depended on the outer caller signalling its foreground process group; signalling only the wrapper PID did not establish that condition.

The baseline was reproduced with actual Node processes, using the unchanged `stopServer()` function from that source. In both cases the descendant ignored TERM. When its leader exited first, and when the leader had already exited before cleanup began, the descendant remained in executing state `S` after `stopServer()` returned. The test harness then explicitly killed its own fixture processes. This establishes the cleanup defect; it does not establish the cause of either historical 900-second browser timeout, a memory leak or an OOM.

## Repair and evidence boundary

Astro, Vitest and style generation now have explicit process owners. On POSIX each producer has a private process group. Cleanup inspects that group after its leader exits and also retains sampled descendant identities when a browser moves into another group. It sends TERM, preserves the existing five-second grace, sends KILL to surviving owned processes, and observes the bounded result. Calls coalesce so the signal handler and normal finalizer share the same cleanup. Vitest cleanup starts on `exit`, before inherited pipes can delay `close`. Shutdown prevents acquiring a new producer after cleanup has started.

Each CI invocation retains `cleanup-<phase-and-shard>.json` with PID/PGID, timestamps, signals, errors, remaining live processes, sampled RSS and up to the last 20 process snapshots. The console emits the summary. A cleanup error or observed live survivor fails an otherwise successful runner; interrupted and failed test outcomes stay failed. RSS is sampled process memory, not a heap or OOM diagnosis. No suite timeout or assertion is relaxed.

The process-table observer verifies the private group and descendants actually observed while their ancestry was available. A process that both detaches and becomes orphaned between samples may not be attributable. This is not a cgroup or OS job-object containment guarantee. Zombies are reported as already stopped, with reaping left to their OS parent. Windows retains the native `taskkill /T /F` operation, hides its window and records that descendant exit was not independently observed; Linux execution is not Windows or macOS execution evidence.

## Executed validation

- Five real-process regression cases passed on Linux/Node 24.22.3: leader-first exit, leader already exited, a sampled detached descendant, an unrelated group remaining alive, coalesced graceful cleanup, and wrapper-only TERM through the actual runner. Several assertions share one case. The last case replaces only the external Vitest executable with a controlled real-process producer; it copies and executes the actual runner and helpers unchanged.
- The complete existing runner control file, including those five cases, passed **143/143**, with no skipped or cancelled tests.
- The actual runner with installed Vitest executed `packages/core/test/reserved-slot.test.ts`: **2/2 passed**. Its cleanup receipt observed the ordinary Vitest workers and esbuild, then no live owned process.

These are bounded runner and consumer-smoke results. They do not replace the complete final-source browser/regression cycles or release rehearsal. The governing release condition remains the original #1178/current-source regression acceptance, including two valid full scheduled recovery cycles. Button lifecycle copy and GitHub governance-snapshot refresh are separate active repair slices.
