# Sprint 1 Matrix: preserve CPU evidence before a blocked final stop

This continues the user's request to complete Sprint 1 and the original #1178 Matrix condition. It changes only the existing explicitly enabled diagnostic helper and its controls. It does not fix or accept the current Matrix initialization failure.

## Real native failure and missing profile

[Diagnostic run 45244534426](https://github.com/Proto-UI/Proto-UI/actions/runs/45244534426), artifact `14853721378`, executed source `81c103bd462b73910f7279122fab5f282d172d56` / tree `3b75082114ecd7026b6d3f5288d0a397a3aef559` with Google Chrome 157.0.8103.78. The complete original 31,069-byte artifact is retained here with SHA-256 `9433da819f8d7f87ace3df9ea2d4609ee2aa7ab630280c45ca1c8b39ce0dff90`.

The selected original all-adapter case reached the real route and failed the unchanged 60,000 ms activation/initialization deadline. Its entry snapshot contained 341 demos / 1,364 previewers, all with registered lazy observations and none initialized. That is an entry observation, not a terminal zero-progress claim. Failure/finally DOM snapshots were unavailable within their original 1,000 ms observation bounds. The diagnostic's other three cases were explicitly unselected; they remain in ordinary full regression.

| Observed boundary | UTC time / result |
| --- | --- |
| Profiler start acknowledged | 2026-11-23 19:03:58.702 |
| Initialization phase entry | 19:04:08.293; 1,364 previewers, zero initialized |
| Original initialization failure | 19:05:08.941 |
| Final profiler stop requested | 19:05:10.949 |
| Stop result | Unavailable within the original 2,000 ms bound; no CPU profile returned |

Network observation records 1,342 requests, 1,332 completed HTTP 200 responses, zero failures and ten pending requests. Those last requests began roughly 59 seconds after diagnostic setup and include Image, Drawer, material and later demo modules. They show continuing acquisition into the catalog. They do not identify the CPU owner, establish an infinite observer loop, or prove a network cause. No missing CPU samples or DOM state have been synthesized.

The separate full browser shard in [run 45238253018](https://github.com/Proto-UI/Proto-UI/actions/runs/45238253018) likewise retains all four Matrix initialization failures, with 31 other shard cases passed. The historical original 1,308-preview condition is preserved; 1,364 is the observed current-source inventory, not a substitute smaller denominator.

## Diagnostic correction

Waiting until the owner finishes can lose every CPU sample when that final stop cannot complete. The existing opt-in collector now stops and restarts its profiler approximately every 20 seconds, retaining each successful chunk immediately. The original 180-second case-owned diagnostic cap, 10 ms sample interval and 2,000 ms protocol-command bounds remain unchanged. Network observation continues until the same owner ends.

Successful captures are retained under immutable numbered `profile-0001.json` files. Each records its actual start acknowledgement, stop request/acknowledgement, CDP sample duration, phase and stop reason. `profile.json` remains a compatibility alias to the latest successful chunk; its own metadata identifies a checkpoint when that is all that succeeded. Terminal `status.json` retains later stop/restart failures and the complete chunk inventory. Reading the alias alone cannot establish complete phase coverage.

The stop/restart gaps are explicitly unsampled. These additional diagnostic operations can affect timing; a profiled run remains diagnostic evidence, not performance acceptance. No route, catalog, input injection, readiness marker, initialization predicate or product scheduling is changed.

An in-flight checkpoint owns its stop/restart operation. Finish retires that owner first and waits for the same bounded operation, avoiding duplicate stops or an additional restart. A timed-out stop leaves protocol state unknown and is not retried. A late restart acknowledgement only detaches; it cannot reactivate capture, overwrite the terminal receipt or schedule another chunk.

## Actual verification and review

The discriminating early-retention control failed against the unchanged collector: one selected test failed and 19 were explicitly unselected. After the repair, the complete diagnostic file passed **22/22**, zero pending. The suite retains the existing default-off, URL privacy, network bounds, original-failure preservation, command bounds and real caller-gating controls. Added controls cover an early successful chunk followed by an unresponsive stop, owner finish during a held checkpoint, and a timed-out restart whose late acknowledgement must not revive the owner. Existing owner-window checks now require continued capture through the original navigation/init interval and terminal cleanup at the unchanged cap.

The two diagnostic files pass a scoped TypeScript check extending the unchanged strict repository configuration. Exact byte comparison verifies that `demo-matrix.browser.test.ts` and `demo-matrix-activation.ts` remain unchanged from the executed 81c source; their original all-four-case selection, current inventory traversal and 60,000 ms limit are intact.

An independent agent reviewed the complete helper, original caller lifecycle and the new held/finish/late-restart controls. It found no blocking ownership or retention issue within this bounded scope. This is local engineering review, not platform approval or native acceptance.

The [manifest and raw evidence](evidence/2026-11-24-sprint1-matrix-cpu-chunks/manifest.json) bind the original native artifact, phase readback, baseline/candidate source hashes, failed control, complete passing suite and type-check result.

## Next acquisition

Publish and execute the same existing opt-in workflow on the integrated source. Inspect all successful numbered chunks together with terminal status, individual clocks and network receipts. A failed later chunk remains failed evidence. Use the resulting exact-source stacks to choose a discriminating product repair, then execute the complete original unprofiled Matrix suite. The original failure remains open until that actual acceptance succeeds.
