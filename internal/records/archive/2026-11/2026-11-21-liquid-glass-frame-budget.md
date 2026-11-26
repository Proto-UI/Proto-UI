# Liquid Glass browser frame cost and input feedback

## Scope and source identities

The current user requested an optimized Liquid Glass Button, a 120 fps / 10 ms target, and presentation informed by Apple's public design guidance. This record preserves actual browser observations and their limits. It does not promote the draft material contracts or claim native Apple implementation parity.

The first matched run is [GitHub Actions 44799728866](https://github.com/Proto-UI/Proto-UI/actions/runs/44799728866), comparing baseline `543c8a2990239dec7c08458a902da3f5a97b49dd` with candidate `9d5a3881deb193c4d4aa30fe88ee08bed401e8e8`. Both revisions ran sequentially on the same Ubuntu runner, with independent dependency links and the same measurement script, lockfile and official material fixture. The retained artifact is `14661455801`; its downloaded ZIP SHA-256 is `2ff06ac9c5ac875ce4dd7bc71c78607b39e9b515fff839511aab62a51bd3b47a`.

The environment was Node `v24.22.3`, Chrome `157.0.8103.78`, Linux x64 with four reported CPUs, and **ANGLE / SwiftShader software rendering**. Observed animation callbacks were approximately 60 Hz. This is not a hardware 120 Hz or physical input-to-photon measurement.

## Method and reproducibility

[`scripts/analysis/liquid-glass-frame-budget.mjs`](../../../../scripts/analysis/liquid-glass-frame-budget.mjs) uses the real `/en/test/liquid-glass-material/` fixture at 1000 × 1050, DPR 1. Three rounds separately observe static idle, static held drag, dynamic idle, and dynamic held drag. The WC Regular button is the timed target; document resource counters include the four mounted adapters. Four additional real pointer smoke journeys cover WC, React, Vue and Vue 2.

Each drag follows the same 120-coordinate path. Requested move spacing is 8.33 ms, but actual injection is constrained by the browser and Playwright: median static move spacing was about 33.3 ms before and 16.7 ms after. These are not fixed-rate 120 Hz input samples. Reported durations, input intervals, distinct commits and unmatched/coalesced moves remain available in the raw report.

The script records rAF timestamps, trusted event timestamps and handler observations, actual `data-material-frame` publication, quality/reason transitions, source revisions, long tasks, owned carrier/image facts, renderer counters and GPU information. A fresh held session associates a pointerdown with its optical commit. A later frame after pointermove is only a many-to-one opportunity, not proof of the rendered coordinate. Commit occurs after image decode/install and before compositor presentation.

`--compare` requires the same probe, workload, browser, lockfile and official diagnostic fixture. Public preview changes are intentionally separate; their source hashes and actual light/dark/narrow screenshots are retained. Invalid optical admission, missing interaction, incomplete windows or failed cleanup are failures rather than faster performance results.

## First browser results

Values below aggregate the three windows of each mode. Renderer means are the sum of `resourceDelta.renderMilliseconds` divided by the sum of `resourceDelta.renders`; encoding is already included. Material throughput divides observed self-optical commits by the actual combined duration. Interval percentiles pool the raw within-window intervals, excluding gaps between windows.

| Workload | Mean render, before → after | Reduction | Material commits/s, before → after | rAF interval p95, before → after | Material interval p95, before → after |
| --- | --- | --- | --- | --- | --- |
| Static backdrop, held drag | 6.502 → 3.132 ms | 51.8% | 32.56 → 59.12 | 16.8 → 16.7 ms | 33.76 → 17.26 ms |
| Dynamic backdrop, idle | 11.509 → 5.250 ms | 54.4% | 7.50 → 7.50 | 50.0 → 16.7 ms | 135.79 → 134.80 ms |
| Dynamic backdrop, held drag | 10.664 → 4.362 ms | 59.1% | 23.63 → 43.95 | 50.0 → 16.8 ms | 80.20 → 42.30 ms |

Static idle generated no new material commits in either revision. Diagnostic dynamic-source cadence remains its historical 120 ms step, so its idle commit rate is not an animation FPS measurement. Dynamic-window long tasks fell from 193 to zero, with respective observation durations of 25.73 and 15.37 seconds; equal coordinate counts did not take equal elapsed time.

| Pointerdown handler → new held optical commit | Before p95 | After p95 | After event timestamp → commit p95 |
| --- | --- | --- | --- |
| Static backdrop | 19.56 ms | 13.78 ms | 13.99 ms |
| Dynamic backdrop | 20.98 ms | 14.03 ms | 14.23 ms |

Each latency mode contains only **three presses**. These are descriptive small-sample percentiles, not production p95 guarantees. The first candidate does not meet a 10 ms application-commit target in this run, and physical display latency remains unmeasured.

Candidate static rendering averaged 2.179 ms in the synchronous readback call, 0.556 ms in PNG encoding and 0.061 ms in contrast checking, with zero new readback-buffer allocations during the warm windows. The baseline does not expose these new stage counters; it must not be assigned zero or used to invent a per-stage reduction.

The independent rAF probe followed the candidate handler by 5.2/5.7/8.0 ms in static windows and 7.8/7.4/7.4 ms in dynamic windows. Held commit followed those probe callbacks by another 5.7–6.6 ms. The probe is not the sink callback, and there are no per-request render/decode markers: these time brackets cannot precisely partition RAF queueing, layout, renderer and decode costs.

## Functional and visual observations

Both revisions completed all twelve timed windows without losing optical admission or receiving untrusted input. All four adapter journeys produced held optical paint, returned to rest and activated once. After disposal, contexts, consumers, pending images and decoded images were zero. Browser page-error logs were empty. The original 1440 px diagnostic fixture also showed genuine optical Regular and Accent controls; an earlier suspected empty-overlay overlap did not reproduce there.

The public Button captures exposed a different concrete problem. Back was genuinely optical in light, dark and narrow views. Continue retained `opaque-fallback / source-overlapping-content`; Unavailable correctly retained its disabled opaque presentation. There are three actual buttons, although the broad capture also observes the tablist and layout host.

Desktop Back's expanded right edge was 497.125 px; Continue needed pixels beginning at 493.125 px. Their optical footprints overlapped by 4 px because the actual DOM gap was 12 px. The same overlap occurred on the narrow page. The follow-up fixes the real demo spacing rather than relaxing source admission. The follow-up public assertion requires both enabled buttons to have committed optical carriers in every captured view and keeps the disabled fallback requirement.

The new layered background removes competing diagnostic text and retains distinct light/dark scenery. The first viewport captures had missing Chinese glyphs on the CI runner, so they cannot establish Chinese typography quality. The follow-up installs and records the same Noto CJK package before both revisions; it does not change production font loading.

## Second browser results

The manual follow-up is [GitHub Actions 44802914287](https://github.com/Proto-UI/Proto-UI/actions/runs/44802914287), comparing the same baseline with candidate `85b55f2f520e39c61c0236e41a8533d242674244`. Artifact `14662003158` has ZIP SHA-256 `a358aa2fd402fa84fc1ef1a73c1dfccd97f98c53364aad737f44832db04d8d36`. Both revisions use Chrome `157.0.8103.78`, Node `v24.22.3`, SwiftShader and the same probe, workload, lockfile and official fixture. The runner installed and recorded `fonts-noto-cjk 1:20230817+repack1-3` and `fontconfig 2.15.0-1.1ubuntu2` before either revision. Baseline timing differs from the first runner, so the matched before/after values below are the relevant comparison; differences across the two candidates alone do not isolate the microtask's effect.

| Workload | Mean render, before → after | Reduction | Material commits/s, before → after | rAF interval p95, before → after | Material interval p95, before → after |
| --- | --- | --- | --- | --- | --- |
| Static backdrop, held drag | 4.969 → 2.100 ms | 57.7% | 52.64 → 59.63 | 16.7 → 16.7 ms | 33.20 → 17.55 ms |
| Dynamic backdrop, idle | 9.036 → 3.604 ms | 60.1% | 7.50 → 7.50 | 33.4 → 16.8 ms | 141.01 → 136.08 ms |
| Dynamic backdrop, held drag | 8.044 → 2.901 ms | 63.9% | 29.68 → 48.53 | 33.31 → 16.7 ms | 70.51 → 35.60 ms |

| Pointerdown handler → new held optical commit | Before p95 | After p95 | After event timestamp → commit p95 |
| --- | --- | --- | --- |
| Static backdrop | 17.31 ms | 6.99 ms | 7.19 ms |
| Dynamic backdrop | 18.02 ms | 7.51 ms | 7.81 ms |

The candidate's six handler-to-commit observations were 5.5/7.1/6.0 ms for static and 7.6/6.7/6.5 ms for dynamic. Including the trusted event timestamp, the maximum was 7.9 ms. Each mode still has only three presses; these observations do not establish a stable production tail below 10 ms. Static idle again performed no new material rendering. The nine dynamic-window long tasks in the baseline fell to zero in the candidate; combined dynamic windows lasted 20.22 seconds before and 14.51 seconds after.

All twelve timed windows, the four adapter smoke journeys, cleanup and browser-error checks passed. Crucially, the strengthened public comparison passed: **both Back and Continue had real owned self-optical paint in all three views**, while Unavailable had no carrier and its sampled background image was exactly `none`. The spacing repair restored the prominent material without relaxing source admission.

Independent visual inspection and a coordinator recheck covered the light, dark and narrow public captures, Chinese viewport typography and the four held-adapter captures. The diagnostic lettering is absent from the public backdrop, primary/secondary labels remain legible and the Chinese missing-glyph problem is resolved. At 390 px the two enabled controls remain on one row, followed by the disabled control and then the status; no overlap or clipping was observed. With this runner's CJK font environment the public button widths are 73.953/101.891/119.484 px, with outsets 7/10/11 px. The 24 px gap therefore leaves 7 px between the enabled footprints and a conservative 3 px for the largest neighboring pair. The earlier 8/4 px calculations describe the first run's different observed font geometry, not this run. These are default-WC public captures; four-adapter pointer smoke does not establish every runtime's visual or latency behavior.

## Expanded third browser results

The integrated candidate `84dde63fe3b35a7aedc22d2e57cec1ba99f1842a` ran in [GitHub Actions 44806177410](https://github.com/Proto-UI/Proto-UI/actions/runs/44806177410). Artifact `14662704075` has ZIP SHA-256 `a707d4d9d4a880962eade48f75461d21bd784918325b23b263f5110d8957c83d`. The same-runner environment again uses Chrome 157, Node 24, four CPUs, SwiftShader and the recorded Noto CJK/fontconfig versions. The official fixture, lockfile and shader remain identical. The accepted main-branch adapter change is recorded as a real source difference. The expanded probe remains byte-identical for both revisions.

**The 10 ms application-latency target is not met in this larger sample.** Each mode contains sixty planned, attempted and resolved presses in each revision. The following values use the trusted event timestamp through the first decoded, installed, owned held-material commit. The earlier six candidate presses below 10 ms remain historical observations and cannot substitute for this larger sample.

| Revision  | Backdrop | p50       | p95       | p99       | Maximum   | Above 10 ms |
| --------- | -------- | --------- | --------- | --------- | --------- | ----------- |
| Baseline  | Static   | 14.350 ms | 16.150 ms | 23.593 ms | 27.900 ms | 34/60       |
| Candidate | Static   | 6.700 ms  | 12.205 ms | 13.023 ms | 13.200 ms | 22/60       |
| Baseline  | Dynamic  | 21.100 ms | 75.000 ms | 76.999 ms | 79.300 ms | 60/60       |
| Candidate | Dynamic  | 12.150 ms | 43.150 ms | 44.282 ms | 44.400 ms | 32/60       |

Starting the clock at the capture listener instead gives candidate p95 11.910/42.850 ms and 22/60 and 30/60 values above 10 ms. There are no missing or unattempted samples, timeouts, untrusted inputs, incorrect sessions/pointers, release failures, invalid timestamps or non-optical trial states. No slow sample is retried or removed. Five ordinary observed RAF-phase bins are populated, unevenly; the candidate dynamic sample also retains eight `late` cases. These are ages relative to observed RAF timestamps, not physical display phases.

Four candidate dynamic trials (zero-based indices 1, 2, 21 and 25) take 42.8–44.2 ms from handler to held commit. Each spans one source-revision advance. Their first post-down independent RAF callbacks are observed 36.6–38.0 ms after down, despite frame timestamps only 0.8–4.3 ms after down. This supports investigating source-update batching and main-thread contention. It does not isolate the per-host rendering, decode and waiting stages; document-wide cumulative counters also include release work. Static cases above 10 ms show that source collision is not the only remaining issue.

| Original matched workload | Mean render, before → after | Reduction | Target material commits/s, before → after |
| --- | --- | --- | --- |
| Static backdrop, held drag | 6.580 → 3.209 ms | 51.23% | 32.18 → 59.36 |
| Dynamic backdrop, idle | 11.548 → 5.291 ms | 54.19% | 7.49 → 7.49 |
| Dynamic backdrop, held drag | 10.754 → 4.402 ms | 59.07% | 23.22 → 42.37 |

The candidate's dynamic material-commit interval p95 remains 42.865 ms. Static idle still has zero new renders and warm readback-buffer allocations remain zero. Baseline dynamic windows contain 196 long tasks and candidate windows contain zero, with unequal elapsed contact-window durations retained in the raw evidence. Actual candidate pointermove intervals have a median of 16.7 ms, not the requested 8.33 ms. This headless run cannot establish 120 displayed frames per second.

All original twelve workload windows, both independent document cleanups, the four adapter pointer journeys and the public comparisons pass. Back and Continue remain owned and optical in light/dark/390 px; Unavailable retains no carrier and an exact `none` image. Both reports have zero page errors. Ordinary CI [44806166573](https://github.com/Proto-UI/Proto-UI/actions/runs/44806166573) passes its lightweight audit/planning checks; its heavy type, test and production lanes are skipped by scheduling policy. It does not replace the local whole-workspace diagnostics or this separately dispatched browser evidence.

The latest timing investigation also identifies avoidable repeated source preparation: in the three dynamic-contact windows, the four optical sources advance by 96/96/100 revisions in aggregate, while preparation runs 120/121/125 times. Each preparation averages about 2.16–2.18 ms. The current program keeps only one prepared source, so alternating sources can evict still-current filtered pixels. A bounded source cache is the next implementation candidate; it is not assumed to remove the entire 43 ms tail.

## Bounded source-preparation follow-up

The next candidate changes only prepared-source reuse in the optical program. It retains at most four filtered sources and 4 MiB of filtered RGBA bytes per program. This is a retained-buffer bound, not a bound on total source, scratch, readback, process or GPU memory. Entries match the exact frame, revision, dimensions, pixel view, canvas and scope; a new revision of the same canvas/scope retires its older entries. Clear-variant calls also perform this retirement. Historical frame and input/DOM identities use weak references or weak membership. Hosts without `WeakRef` retain a single strong slot rather than acquiring a new platform requirement.

There is still one current GPU texture. Returning to a cached CPU source uploads it again when another source or variant currently occupies that texture. Same-frame metadata or pixel-view replacement invalidates both reuse decisions. All source/geometry/contact admission checks, including the per-call alpha scan, precede cache lookup. The prefilter, uniforms, draw, readback, contrast scan and PNG output sections remain byte-identical to `84dde63fe3b35a7aedc22d2e57cec1ba99f1842a`. Clear, disposal and context loss release the cache. Inspection adds one cumulative cache-hit counter and current entry/byte gauges; gauges must not be interpreted as allocation counters.

The discriminating A→B→A regression fails on the previous implementation because it performs three preparations, then passes with two preparations and all three required texture uploads. The final focused run passes 110 tests (75 program, 25 style-tint and 10 style); scoped TypeScript, formatting and diff whitespace checks pass. These checks cover entry/byte eviction, revision and view replacement, clear/regular transitions, cached-source opacity rejection, missing `WeakRef` and cleanup. Independent review also verifies that four old source identity targets can be garbage-collected after switching sources, the maximum admitted 4 MiB frame evicts smaller entries correctly, and clear/dispose accounting remains bounded. Those mock-GL and GC checks are correctness evidence, not browser timing.

The reviewed program SHA-256 is `c084788bfc4974d09274ab832ab98c81ef4fd33f218b45eb5ea2f4ce476e2a29`; its test SHA-256 is `bc07c1010d50995271ea78c31a29658859f4b8622cc3cc5d680240f6da2a8391`. The next native run retains the exact sixty-press probe and its earlier failure distributions. No latency improvement is assigned to this cache before that run, and comparisons with the third run alone cannot isolate its effect across different runners.

## Fourth browser results: bounded cache

[GitHub Actions 44811618004](https://github.com/Proto-UI/Proto-UI/actions/runs/44811618004) measures candidate `1d860891a59aca6ed71ac251e08977cde303b81c` against the original fixed baseline. Artifact `14668326440` is 2,488,964 bytes with ZIP SHA-256 `6d188b9c718f004b7cce92299ce0e33b605aa8c468d2936d59dee657f2b7d53f`. Both source checkouts are clean and use the same unchanged probe `62fb8587b9f64ada31135e83d3a5ff287edc8e946be6d18ab973d2f5d853c6a9`; candidate program bytes match the reviewed cache hash above. The software-GPU environment is again Chrome 157 / Node 24 / four CPUs with the same CJK fonts. Its Linux runner is `7.0.0-1014-aws`, whereas the preceding run used `7.0.0-1017-azure`; cross-run timing changes cannot isolate the LRU effect.

**The larger-sample 10 ms target remains unmet.** All sixty presses per revision and mode are attempted and resolve with the exact session, trusted pointer identity, owned held image and corresponding release. There are no missing samples, retries, timeouts, invalid event timestamps or non-optical trials. Event time includes browser delivery before the capture listener and still excludes physical device transport. The endpoint remains owned image installation observed at MutationObserver entry, before compositor presentation.

| Revision  | Backdrop | Event → commit p50 | p95       | p99       | Maximum   | Above 10 ms |
| --------- | -------- | ------------------ | --------- | --------- | --------- | ----------- |
| Baseline  | Static   | 14.050 ms          | 15.210 ms | 21.604 ms | 30.100 ms | 36/60       |
| Candidate | Static   | 6.950 ms           | 12.215 ms | 13.087 ms | 13.500 ms | 25/60       |
| Baseline  | Dynamic  | 20.100 ms          | 72.545 ms | 74.082 ms | 74.200 ms | 60/60       |
| Candidate | Dynamic  | 11.200 ms          | 40.720 ms | 42.166 ms | 43.700 ms | 37/60       |

Candidate listener-origin p95 is 11.910/13.520 ms, but its dynamic p99/max remains 40.505/40.800 ms. The four slow dynamic event-origin samples show why the two origins must remain separate:

| Trial, zero-based | Event → listener | Listener → held | Event → held | Source revision |
| ----------------- | ---------------- | --------------- | ------------ | --------------- |
| 24                | 29.8 ms          | 13.9 ms         | 43.7 ms      | 105 → 106       |
| 1                 | 27.6 ms          | 13.5 ms         | 41.1 ms      | 19 → 20         |
| 2                 | 0.3 ms           | 40.8 ms         | 41.1 ms      | 23 → 24         |
| 25                | 0.4 ms           | 40.3 ms         | 40.7 ms      | 109 → 110       |

Selecting the smaller listener p95 would hide substantial waiting before the event handler. These four samples all span a source revision, with two mostly delayed before the listener and two mostly delayed afterward. They support investigating source-update batches, without assigning all remaining time to PNG decoding. Static phase-dependent tails also remain. The five ordinary phase bins are populated unevenly; candidate static has five late samples and dynamic twenty. No sample is replaced to obtain a preferred phase distribution.

| Matched workload | Mean render, before → after | Reduction | Target material commits/s, before → after |
| --- | --- | --- | --- |
| Static backdrop, held drag | 5.894 → 2.472 ms | 58.06% | 32.08 → 59.55 |
| Dynamic backdrop, idle | 11.149 → 4.642 ms | 58.36% | 7.49 → 7.49 |
| Dynamic backdrop, held drag | 10.289 → 3.537 ms | 65.62% | 23.28 → 45.28 |

Candidate dynamic material-commit interval p95 is 41.265 ms; static/dynamic RAF p95 is approximately 16.8 ms. Static idle still generates no new renders and warm readback-buffer allocations remain zero. Baseline dynamic windows record 197 long tasks and candidate windows zero, with unequal contact-window durations. This remains an approximately 60 Hz headless run, not evidence of 120 displayed frames per second.

Cache observations now confirm reuse. Static-contact windows contain 411 renders, zero preparations, 411 cache hits and one upload. Dynamic-contact windows contain 616 renders, 272 preparations, 344 hits and 342 uploads; preparations match the aggregate 88/92/92 source-revision advances. Dynamic idle contains 180 renders and preparations with no hits. Hits include the already-current-source reuse that existed before this cache, so they cannot all be presented as newly eliminated work. A cache hit can still require texture upload. The 276 retained boundary snapshots each show four entries and 1,071,616 filtered-RGBA bytes, about 1.022 MiB; this is neither a continuous peak nor total process/GPU memory. After pool disposal, cache gauges are unavailable, while the four independent lifecycle counters are explicitly zero in both documents.

All twelve workload windows, four adapter pointer journeys and public captures pass, with no page errors. Both enabled public buttons remain genuinely optical and the disabled button has no carrier or image. The three candidate public crop PNGs are byte-identical to their third-run counterparts, and were inspected again. Same-head ordinary CI [44811573841](https://github.com/Proto-UI/Proto-UI/actions/runs/44811573841) passes its scheduled lightweight checks. The full reconstruction, including all latency samples and cache-gauge boundaries, is retained in [44811618004-summary.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-21-liquid-frame-budget/44811618004-summary.json).

The next bounded hypothesis is to separate expensive, compatible source-refresh work into browser tasks only for an already-decoded, owned neutral image at rest. Synchronous source/style/geometry/preference revocation and pure input validation must remain in the source notification, and task execution must re-read the latest state. Cold, claimed-but-not-decoded, active pointer, keyboard pressed and release-animation paths are excluded. This is an implementation candidate under independent review, not a measured scheduling improvement. Four-host progress must be observed so a lower target latency cannot conceal starvation elsewhere.

## Subsequent GPU candidate and scheduling continuation

The branch later advances to `19d175f454468fa27364c8283e084f3bb7a1016b`. Its native run `44814656275` fails in the multi-runtime consumer, despite passing its independent GPU byte matrix and public captures. The complete failure, bounded GL lifecycle repair, merged source-task candidate and four-host progress method are recorded in [source refresh scheduling and GPU recovery](2026-11-21-liquid-glass-source-refresh-tasks.md). That run compares against `1d86089`, not the original fixed baseline used in the four sections above, and its expanded measurement instrument has a different hash. No candidate latency can be derived from its unattempted trials.

## Follow-up and remaining acceptance

The first timing results motivated the bounded fresh-press microtask through the existing sink admission/render/decode path. Pointer moves retain RAF coalescing, and the original RAF still settles the latest state. The second and third runs measure the resulting candidates; the larger sample demonstrates why the six fast observations cannot establish the requested latency target.

The expanded probe keeps the original twelve workload windows and adds static/dynamic modes with sixty fresh presses each, in six predetermined twenty-press blocks. Each independent collector observes eight RAF callbacks, then uses the declared phase/source-delay sequence before one trusted down. It records actual age since the latest RAF timestamp and its phase bin rather than assuming the requested delay achieved uniform coverage. The dynamic source keeps advancing at its existing 120 ms cadence throughout its blocks. Only a new frame with exactly the next session, within that down's bounded window and before release, can satisfy the trial; the MutationObserver entry timestamp precedes synchronous owned-paint verification. Held, release and RAF warmup have fixed two-second deadlines. Slow, unresolved and unattempted presses remain explicit; no slow sample is retried or filtered. A separate fixture document is disposed and checked for zero resources. Ten attribution tests and independent negative-case review pass. The workflow gates ownership and completeness, while reporting any 10 ms exceedances without turning a timing threshold into a functional assertion.

The fresh-press regression first produced three intended failures and ten passes, then passed all thirteen cases with the change. Eight related suites passed 289 tests, scoped TypeScript checking passed, and an independent review additionally checked cancellation after early decode, document adoption, same-turn candidate withdrawal and reentrant input. The microtask leaves the current contact-router callback; it does not promise that every native event listener or framework flush has completed. The tightened public observer passed seven tests, including rejection of a disabled button with a residual carrier or image even when its `committed` flag is false. The real demo's spacing budget and existing public carrier style check passed four tests. These checks support the second candidate; none measures native latency or display refresh.

While this work continued, main advanced to `57819223e7c07b31f43b779eea011912f48bec5a`. Its changes since this branch's original base are reviewed coverage bindings and the already accepted Web Component initial split-projection fix from `6944f6d`. The integration preserves that adapter source byte for byte. The only textual merge conflict is resolved by retaining the new main helper bindings together with the three reviewed Liquid Glass source fingerprints. Independent review confirms all 199 source-binding paths and owners are retained, with only those three hashes changed relative to main. Seven focused Web Component acquisition/effects/material/admission/failure/resource-generation suites pass 139 tests after integration. The third repeated-press run measures that integrated candidate and records the real adapter source difference; prior candidate evidence is not silently reassigned to the merged head.

The initial experimental workflow incorrectly declared an automatic PR trigger. Ordinary CI [44799728845](https://github.com/Proto-UI/Proto-UI/actions/runs/44799728845) rejected that scheduling configuration. The corrected workflow is manual/callable, keeps read-only permissions and bounded timeouts, and passes all 21 scheduling policy controls. The first benchmark success does not erase the separate initial CI failure.

The first combined material/prototype/scene test run passed 473 tests. The reviewed source/scene fixes and adjacent consumers passed 75 tests; final website type checking reported 1,243 files, zero errors and zero warnings (31 hints). After official style generation, the whole-workspace type check still reports the two unchanged Compiler diagnostics in `gpui-data-methods.ts` and `parser.ts`. A coverage inventory attempt reported 131 findings before the latest bounded fingerprint reconciliation; this record does not claim that broader gate is green.

Final acceptance still needs the source-scheduling investigation and genuine 120 Hz hardware observations. The current sixty-press distributions do not meet 10 ms in this environment. A mean render time below 8.33 ms alone does not prove a complete 120 fps pipeline; neither a material commit nor an artificial rAF clock measures physical input-to-photon latency. Independent platform review and the responsible author's DCO certification also remain required before integration. Vercel separately reports a deployment rate limit with a 24-hour retry message; no preview deployment success is inferred from the browser CI.
