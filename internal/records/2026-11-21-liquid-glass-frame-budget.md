# Liquid Glass browser frame cost and input feedback

## Scope and source identities

The current user requested an optimized Liquid Glass Button, a 120 fps / 10 ms target, and presentation informed by Apple's public design guidance. This record preserves actual browser observations and their limits. It does not promote the draft material contracts or claim native Apple implementation parity.

The first matched run is [GitHub Actions 44799728866](https://github.com/Proto-UI/Proto-UI/actions/runs/44799728866), comparing baseline `543c8a2990239dec7c08458a902da3f5a97b49dd` with candidate `9d5a3881deb193c4d4aa30fe88ee08bed401e8e8`. Both revisions ran sequentially on the same Ubuntu runner, with independent dependency links and the same measurement script, lockfile and official material fixture. The retained artifact is `14661455801`; its downloaded ZIP SHA-256 is `2ff06ac9c5ac875ce4dd7bc71c78607b39e9b515fff839511aab62a51bd3b47a`.

The environment was Node `v24.22.3`, Chrome `157.0.8103.78`, Linux x64 with four reported CPUs, and **ANGLE / SwiftShader software rendering**. Observed animation callbacks were approximately 60 Hz. This is not a hardware 120 Hz or physical input-to-photon measurement.

## Method and reproducibility

[`scripts/analysis/liquid-glass-frame-budget.mjs`](../../scripts/analysis/liquid-glass-frame-budget.mjs) uses the real `/en/test/liquid-glass-material/` fixture at 1000 × 1050, DPR 1. Three rounds separately observe static idle, static held drag, dynamic idle, and dynamic held drag. The WC Regular button is the timed target; document resource counters include the four mounted adapters. Four additional real pointer smoke journeys cover WC, React, Vue and Vue 2.

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

## Follow-up and remaining acceptance

The first timing results motivated the bounded fresh-press microtask through the existing sink admission/render/decode path. Pointer moves retain RAF coalescing, and the original RAF still settles the latest state. The second run measures the resulting candidate; a larger repeated-press sample is planned to test whether the small-sample latency improvement holds across varied observed frame phases.

The expanded probe keeps the original twelve workload windows and adds static/dynamic modes with sixty fresh presses each, in six predetermined twenty-press blocks. Each independent collector observes eight RAF callbacks, then uses the declared phase/source-delay sequence before one trusted down. It records actual age since the latest RAF timestamp and its phase bin rather than assuming the requested delay achieved uniform coverage. The dynamic source keeps advancing at its existing 120 ms cadence throughout its blocks. Only a new frame with exactly the next session, within that down's bounded window and before release, can satisfy the trial; the MutationObserver entry timestamp precedes synchronous owned-paint verification. Held, release and RAF warmup have fixed two-second deadlines. Slow, unresolved and unattempted presses remain explicit; no slow sample is retried or filtered. A separate fixture document is disposed and checked for zero resources. Ten attribution tests and independent negative-case review pass. The workflow gates ownership and completeness, while reporting any 10 ms exceedances without turning a timing threshold into a functional assertion.

The fresh-press regression first produced three intended failures and ten passes, then passed all thirteen cases with the change. Eight related suites passed 289 tests, scoped TypeScript checking passed, and an independent review additionally checked cancellation after early decode, document adoption, same-turn candidate withdrawal and reentrant input. The microtask leaves the current contact-router callback; it does not promise that every native event listener or framework flush has completed. The tightened public observer passed seven tests, including rejection of a disabled button with a residual carrier or image even when its `committed` flag is false. The real demo's spacing budget and existing public carrier style check passed four tests. These checks support the second candidate; none measures native latency or display refresh.

While this work continued, main advanced to `57819223e7c07b31f43b779eea011912f48bec5a`. Its changes since this branch's original base are reviewed coverage bindings and the already accepted Web Component initial split-projection fix from `6944f6d`. The integration preserves that adapter source byte for byte. The only textual merge conflict is resolved by retaining the new main helper bindings together with the three reviewed Liquid Glass source fingerprints. Independent review confirms all 199 source-binding paths and owners are retained, with only those three hashes changed relative to main. Seven focused Web Component acquisition/effects/material/admission/failure/resource-generation suites pass 139 tests after integration. The final repeated-press run will measure the integrated candidate and record the adapter hash; prior candidate evidence is not silently reassigned to the merged head.

The initial experimental workflow incorrectly declared an automatic PR trigger. Ordinary CI [44799728845](https://github.com/Proto-UI/Proto-UI/actions/runs/44799728845) rejected that scheduling configuration. The corrected workflow is manual/callable, keeps read-only permissions and bounded timeouts, and passes all 21 scheduling policy controls. The first benchmark success does not erase the separate initial CI failure.

The first combined material/prototype/scene test run passed 473 tests. The reviewed source/scene fixes and adjacent consumers passed 75 tests; final website type checking reported 1,243 files, zero errors and zero warnings (31 hints). After official style generation, the whole-workspace type check still reports the two unchanged Compiler diagnostics in `gpui-data-methods.ts` and `parser.ts`. A coverage inventory attempt reported 131 findings before the latest bounded fingerprint reconciliation; this record does not claim that broader gate is green.

Final acceptance still needs the repeated-press results and genuine 120 Hz hardware observations. A mean render time below 8.33 ms alone does not prove a complete 120 fps pipeline; neither a material commit nor an artificial rAF clock measures physical input-to-photon latency. Independent platform review and the responsible author's DCO certification also remain required before integration.
