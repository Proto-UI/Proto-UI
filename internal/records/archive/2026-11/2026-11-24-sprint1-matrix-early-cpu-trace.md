# Sprint 1 Matrix: preserve the first browser CPU receipt and isolate an early trace

This record continues #1178 after the first successful acquisition of process CPU samples. The original Matrix condition still fails. The next diagnostic changes the observation channel, not the product, inventory, activation or acceptance deadline.

## What actually executed at 6ccb

[Run 45259452427](https://github.com/Proto-UI/Proto-UI/actions/runs/45259452427), artifact `14859568084`, executed source `6ccb36ad473b72e75b3b86ee9ea5a5989b73ac5b`. The complete original ZIP is **544,115 bytes**, SHA-256 `f40101ca769ba9703d16bbb13d89812eda175c2e5ea520053fc38423aaf8b397`. Its CRC and hash were independently checked before analysis and the whole ZIP is retained in this carrier.

The selected all-adapter Matrix case failed the original **60,000 ms initialization limit**. The other three original cases were explicitly unselected, not passed. The previously recorded current inventory is 1,364 previewers, with the historical 1,308 condition preserved separately. Neither the diagnostic nor this follow-up reduces either denominator.

In this particular run, the only captured DOM snapshot belongs to the blank page before navigation. The loaded-route, initialization and final snapshots were unavailable within their existing one-second observation bound. Its initial zero counts do not establish a zero-initialized result after loading, and this run's DOM snapshots do not independently recount 1,364 previewers.

The browser-level CPU channel returned **15 samples** over **70,028 ms** between its first and last admitted sample. These are cumulative CPU seconds across every thread of each process, not main-thread JavaScript durations.

| Same process identity | First CPU seconds | Last CPU seconds | CPU increment |
| --------------------- | ----------------: | ---------------: | ------------: |
| Renderer 3037         |              0.04 |            92.47 |       92.43 s |
| Renderer 3028         |              0.08 |            12.39 |       12.31 s |
| Browser 2941          |              0.45 |             2.48 |        2.03 s |
| GPU 2983              |              0.04 |             1.11 |        1.07 s |
| Network service 3000  |              0.06 |             1.20 |        1.14 s |

Renderer 3037 accumulates CPU throughout the sample sequence. Its increment divided by the observation span is about 1.32 CPU-seconds per wall second across its threads. This rules out treating the observed interval as an entirely idle renderer. It does not distinguish JavaScript work, compilation, layout, a particular observer, or a loop. The remaining process rows and every original sample are preserved.

The network observer recorded 1,356 requests, 1,328 completed HTTP 200 responses, zero failed requests and 28 pending rows. The pending rows record when requests were observed; they are not measured server wait durations. The original page-level profiler again failed to stop within its two-second command bound and returned no CPU profile chunk.

## The trace is explicitly partial

The browser trace started successfully. Its end request at 20:30:35.502 UTC was acknowledged at 20:30:35.505, but `tracingComplete` did not arrive within the existing two-second flush bound. Terminal state is **partial**, with `completeAt: null` and `dataLossOccurred: null`. The absence of a completion event cannot be converted to a no-data-loss claim.

The observer received 34,016 events and retained 19,618. It reached the **256-file cap**, having stored 5,795,615 bytes, before reaching the separate 16 MiB serialized-output cap. The last observed rolling-buffer occupancy was about 99.28%. Local truncation is therefore established; complete browser-buffer retention is unproven.

There are 15,009 retained `FunctionCall` events, all from renderer 3037, spanning only **5,012.015 ms** of Chromium's monotonic event clock. Of these, 7,008 name `onProjectionEvent`. Some other timed event types span a much longer interval, so it would also be wrong to describe the entire retained trace as only five seconds long. There are **zero retained `Profile` or `ProfileChunk` events**. Callback counts and overlapping event durations from this partial tail cannot identify the dominant cost of the whole startup interval. No observer or product code is changed on that basis.

## The next bounded experiment

The existing explicit browser-diagnostic mode now requests only `disabled-by-default-v8.cpu_profiler`. It omits the two high-volume timeline categories used in the previous acquisition. V8's [checked-in tracing-profiler test](https://chromium.googlesource.com/v8/v8/+/906a69c43fd43002911f4f8bdbe8110b4a2e9b8b/test/cctest/test-cpu-profiler.cc) enables that category around JavaScript execution; its [profile emitter](https://chromium.googlesource.com/v8/v8.git/+/main/src/profiler/profile-generator.cc) identifies `Profile` and `ProfileChunk` in that category. These primary-source checks explain the requested channel. They do not prove that the installed Chromium will return useful samples during this failing page.

The trace requests one early stop **20 seconds after its start acknowledgement**. It never restarts. The existing 16 MiB rolling buffer, 16 MiB retained-byte limit, 256-file limit, two-second command/flush bound and absolute 180-second diagnostic owner remain unchanged. Its receipt records the requested window, acknowledgement clocks and actual stop reason. A stop acknowledgement still needs `tracingComplete` before the trace state can be called complete, and even that state does not certify a complete/loss-free phase or a successful Matrix initialization.

The independent process CPU channel continues after the trace checkpoint. The page's network observer also continues until the original case finishes. The case's original 60-second initialization attempt is not cancelled or shortened by the diagnostic checkpoint.

An explicitly supplied owned Browser selects this browser-trace mode and prevents creation of a page-level CDP profiler. This avoids simultaneous profilers on the same isolate during the new experiment. There is no automatic page-profiler fallback if browser setup fails; that failure remains an explicit receipt. The existing page-only diagnostic path remains available under its previous flag configuration, and ordinary Matrix execution remains uninstrumented.

The early trace stop owns one shared Promise for its bounded flush, listener removal and detach. If the case finishes while that work is pending, owner finish waits for the same operation before recording its terminal result. A later acknowledgement cannot resurrect the trace or overwrite the terminal receipt. The CPU channel retains its separate retirement and cleanup ownership.

## Local controls and limits

Three newly selected controls fail against the previous helper: it did not stop a trace at the early checkpoint, owner finish did not encounter an already-running early stop, and browser mode still started a page profiler. That run contains **3 failed / 36 explicitly unselected** cases. These are discriminating controls for the newly requested diagnostic behavior, not three new Matrix product defects.

The complete two diagnostic suites then passed **39/39**, zero failed or pending. They include continued CPU/network observation after early trace retirement, a held checkpoint shared with owner finish, late acknowledgements, independent channel failure, source-payload filtering, fixed byte/file bounds, setup retirement, original-error preservation and the unchanged real caller gates.

The first scoped type check found an overly broad `string` annotation on the owner-finish reason passed to the newly constrained trace operation. Narrowing that annotation fixed the check. The final scoped TypeScript and formatting/diff checks exited 0. The pre/post annotation sources were hashed and independently transpiled: their emitted JavaScript is byte-identical. Thus the final annotation does not change the runtime verified by the full 39-case run. The initial type failure remains in the archive as an implementation iteration.

The Matrix caller and `demo-matrix-activation.ts` are byte-identical to executed 6ccb. The complete original inventory, viewport, navigation, activation logic, readiness checks and product deadlines are untouched. These local controls verify the diagnostic owner; a new real browser run must establish whether it captures CPU samples, and an unprofiled complete Matrix run must still satisfy the original acceptance condition.

The parent agent independently read the four-file diff, the complete browser setup/finish path, startup teardown and all three new controls. It found no blocking issue within the single early window, shared terminal Promise, late-result refusal or profiler exclusivity. This is a bounded local engineering review, not a formal GitHub approval or a new native capability result.

## Carrier

[Manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint1-matrix-early-cpu-trace/manifest.json) and [raw evidence](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint1-matrix-early-cpu-trace/raw-evidence.zip) retain the complete 6ccb ZIP, independently derived readback, before/final helper sources, actual red/green reports and logs, the type-check iteration, type-erasure comparison, commands and exact source snapshot. The carrier identifies a dirty shared checkout plus the exact changed file hashes; it is not a native pass of the new diagnostic.

The next reading must reconcile any actually retained profile samples with their explicit clocks and partial/truncation status. No sampled stack, root cause, product repair, complete 60-second initialization or #1178 closure is asserted here.
