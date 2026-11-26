# Sprint 1 Matrix: independent browser CPU and bounded trace evidence

This record continues the original #1178 Matrix investigation. It preserves the second real failed acquisition and adds a distinct, explicitly enabled observation channel. It does not repair or accept the Matrix initialization failure.

## What the real 333f run proves

[Run 45248740693](https://github.com/Proto-UI/Proto-UI/actions/runs/45248740693), artifact `14856290448`, executed source `333f2b19cc7bbe52deab3999f7beef34f6845304` / tree `1115f5befdeda79bc3276e713ee107ab39090d21` with Node `v24.22.3` and Google Chrome `157.0.8103.78`. Its complete original archive is retained: **54,180 bytes**, SHA-256 `0e32de1e728f6912978baa77ac722e28fbf40524af93cd94fdb88223ae404a40`.

The selected original all-adapter case failed; the other three original cases were explicitly unselected, not passed. The route opened and its initialization entry snapshot had 341 demos / 1,364 previewers / zero initialized. That is an entry snapshot. The terminal DOM snapshot was unavailable, so the run does not establish a terminal zero-initialized count.

| Actual boundary | UTC time / outcome |
| --- | --- |
| Page CPU profiler start acknowledged | 2026-11-23 19:27:22.266 |
| Route-open observation passed | 19:27:30.791; current inventory 1,364 |
| Initialization phase entered | 19:27:31.093 |
| First 20-second CPU checkpoint stop requested | 19:27:42.267 |
| Checkpoint result | Unavailable within 2,000 ms; zero profile chunks returned |
| Original initialization failure | 19:28:31.231; unchanged 60,000 ms limit |
| Failure and finally snapshots | Each unavailable within the existing 1,000 ms observation bound |
| Diagnostic terminal receipt | 19:28:33.237; elapsed 71,198 ms |

The network observer counted 1,418 requests, 1,353 completed HTTP 200 responses and zero failures. Its final bounded list contained 65 pending rows whose requests started 68,754–69,236 ms after diagnostic setup. The network record explicitly reports that its earlier row retention was truncated. These are request-observation timestamps, not response durations or server queue times. They show ongoing acquisition but do not identify the cause of the renderer's unavailable responses. Neither this run nor the [preceding final-stop failure](2026-11-24-sprint1-matrix-cpu-chunks.md) returned CPU stacks that could establish a particular loop, layout cost or blocked module.

The original historical 1,308-preview condition remains preserved. The current 1,364 inventory is not a reduced substitute. The original 60,000 ms initialization deadline and complete ordinary Matrix selection remain unchanged.

## Different observation channel, with explicit limits

The caller launches its own Chromium Browser and closes it after the sequential suite. Each case uses a fresh context. Only that exclusive test Browser is supplied to the new helper; it never discovers or attaches to a user's browser or another session.

The installed Playwright `1.58.2` primary API/protocol definitions and its Chromium implementation were read before implementation; their paths and hashes are in the evidence manifest. `SystemInfo.getProcessInfo` reports cumulative CPU seconds across all threads of each process. `Tracing.dataCollected` is delivered when tracing stops, and `tracingComplete` follows buffer flush. Thus changing to browser-level tracing does **not** promise periodic trace events or guarantee that an unresponsive renderer will flush.

The new helper uses two separate browser-level CDP sessions:

- **Process CPU:** takes an initial sample and nominal five-second follow-ups, without overlapping requests. Each admitted result immediately queues an immutable `cpu-0001.json` file containing process ID, process type, cumulative CPU seconds, phase and receipt clocks. A failed/unresponsive endpoint retires only this channel. Comparing admitted samples can distinguish substantial process CPU consumption from little CPU progress. These values cover all process threads; they cannot identify a JavaScript function or by themselves explain the wait.
- **Trace:** requests only `devtools.timeline`, `v8.execute` and `disabled-by-default-v8.cpu_profiler`, with other categories excluded, a 16 MiB rolling Chromium buffer and no screenshots. Explicitly included categories precede the excluded wildcard in the [Chromium category filter](https://chromium.googlesource.com/chromium/src/+/main/base/trace_event/trace_config_category_filter.cc), observed blob `470dbbb42f78c3975920b95cc7143394339ccf5e`. That source check establishes filter meaning, not actual native trace availability.

Any received trace buckets are immediately serialized into numbered files. Retained JSON files have an additional total 16 MiB byte cap and a 256-file cap. A field projection retains event clocks, process/thread names, script frame locations and CPU-profile facts; arbitrary arguments, source payloads, screenshots, request bodies and headers are omitted. Script URLs lose credentials, query and fragment; non-HTTP/unresolved URLs are replaced. Oversized profile arrays and total output truncation are reported separately.

Terminal status records start/stop acknowledgement clocks, received completion, protocol `dataLossOccurred`, local output/projection truncation, received/retained event counts and bytes, and setup/stop/cleanup outcomes. The state `complete` means **both** `Tracing.end` acknowledged and `tracingComplete` arrived. It does not mean a complete owner window, loss-free data, a successful 60-second initialization or performance acceptance. An acknowledgement without completion, completion without acknowledgement, or a stop timeout remains `partial`/unavailable as appropriate. Partial buckets are retained even when the final stop cannot be confirmed.

Every protocol command is bounded at 2,000 ms. The owner retains the original absolute 180-second diagnostic cap. Finish first retires further CPU/setup work, then permits already-owned trace events only during the bounded stop/flush window, removes listeners and awaits the same bounded cleanup operation if it already started. Late setup or sample responses cannot write another receipt or schedule a new probe. Finish is idempotent. The Browser's existing suite teardown remains the final process owner.

The existing page CPU chunk helper remains in place. Browser CPU/Trace start and finish alongside it, so an unavailable page-level `Profiler.stop` does not prevent collection by the independent browser sessions. All these probes add diagnostic overhead; a profiled run remains unsuitable as the ordinary performance acceptance result.

## Explicit gate and unchanged acceptance

Both flags are required on the existing selected diagnostic case, together with its existing evidence directory:

```sh
PROTO_UI_MATRIX_STARTUP_PROFILE=1
PROTO_UI_MATRIX_BROWSER_DIAGNOSTIC=1
```

The Matrix caller changes only by passing its owned Browser under the second explicit flag. Navigation, first-visible-preview observation, catalog, viewport, initialization, readiness, runtime traversal and assertions are unchanged. `demo-matrix-activation.ts` is byte-identical to executed `333f`, SHA-256 `4ed8116369f2fee3872be81dabdaf4c6ad22de3bf74694f5091066637687dcb5`. The ordinary run has no Browser diagnostic session or new sampling timers. Workflow opt-in and a new native dispatch remain integration actions owned by the parent task.

## Verification and independent review

The final two diagnostic suites passed **36/36**, zero failed/pending. These are 12 new browser-observer cases and 24 page-observer/caller cases. They cover default-off behavior, independent CPU/Trace failures, successive process samples, trace sanitization and byte limits, incomplete stop acknowledgements, late session creation/start/sample results, original-error preservation, owner deadline, shared cleanup and real caller opt-in. The scoped TypeScript check and formatting check both exited 0.

A real-clock negative control replays the first Browser helper in memory. After a failed CPU query began an unresponsive detach, that helper wrote its terminal receipt after only **1 ms**, without waiting for the already-started 2,000 ms cleanup. The selected control failed; its other 11 cases were explicitly unselected. The corrected helper shares the same bounded detach Promise and records `detachState: unavailable` only after the bound expires. The final full 36-case run includes this real-clock control. No shared source file was temporarily overwritten for the replay.

Two earlier attempts at that control used fake time and also advanced pending filesystem writes past their deadline, producing missing receipts/ENOENT. Those failures are retained and explicitly classified as invalid detach-timing evidence. They are not counted as product defects or used as the successful negative control. The intermediate 35- and 36-case green runs remain intermediate receipts; the final 36-case run and final source snapshot are the acceptance evidence for this helper.

An independent agent read the final helper, including separate sessions, setup timeout retirement, late callbacks, stop/flush admission and shared cleanup. It found no blocking issue in that bounded review. It did not rerun these tests or use a native browser. This local engineering review is not GitHub approval, native capability proof or Matrix acceptance.

## Source-bound carrier and next reading

[Manifest](evidence/2026-11-24-sprint1-matrix-browser-diagnostic/manifest.json) and [raw evidence](evidence/2026-11-24-sprint1-matrix-browser-diagnostic/raw-evidence.zip) contain the complete original 333f artifact, extracted phase readback, old/new helper sources, actual reports/logs, replay config, exact commands, dependency-source hashes and independent review scope. The archive is **146,117 bytes**, SHA-256 `498143c25d6f3ade469ed3081a82b1bfc0359a4575ae0bdf39579e360f629f96`; all 37 entries passed CRC and every payload size/hash was read back and verified.

The helper source hash is `c395360bed75a4603a7db75cbd1b8512e8d7cc9b72c02d3b64f9c40fc5439148`. The snapshot names its shared checkout plus the exact dirty files used, not a clean-head native pass.

After native execution, read the original readiness receipt, numbered process samples and terminal trace status together. Compare process CPU deltas only for compatible process identities and monotonic counters, reconcile their wall clocks with the phase boundaries, and inspect any actually retained trace events for a source-local cause. If tracing still cannot flush, the CPU samples remain a separate bounded observation. Do not turn job completion or a partial trace into sampled-frame evidence. A product repair still needs a discriminating failure and the complete original unprofiled Matrix acceptance.
