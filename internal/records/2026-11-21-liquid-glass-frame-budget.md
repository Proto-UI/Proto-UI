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

## Follow-up and remaining acceptance

The first timing results motivate a bounded fresh-press microtask through the existing sink admission/render/decode path. Pointer moves retain RAF coalescing, and the original RAF still settles the latest state. This is a hypothesis to measure on the next candidate, not a latency result inferred from a unit test.

The fresh-press regression first produced three intended failures and ten passes, then passed all thirteen cases with the change. Eight related suites passed 289 tests, scoped TypeScript checking passed, and an independent review additionally checked cancellation after early decode, document adoption, same-turn candidate withdrawal and reentrant input. The microtask leaves the current contact-router callback; it does not promise that every native event listener or framework flush has completed. The tightened public observer passed seven tests, including rejection of a disabled button with a residual carrier or image even when its `committed` flag is false. The real demo's spacing budget and existing public carrier style check passed four tests. These checks support the second candidate; none measures native latency or display refresh.

The initial experimental workflow incorrectly declared an automatic PR trigger. Ordinary CI [44799728845](https://github.com/Proto-UI/Proto-UI/actions/runs/44799728845) rejected that scheduling configuration. The corrected workflow is manual/callable, keeps read-only permissions and bounded timeouts, and passes all 21 scheduling policy controls. The first benchmark success does not erase the separate initial CI failure.

The first combined material/prototype/scene test run passed 473 tests. The reviewed source/scene fixes and adjacent consumers passed 75 tests; final website type checking reported 1,243 files, zero errors and zero warnings (31 hints). After official style generation, the whole-workspace type check still reports the two unchanged Compiler diagnostics in `gpui-data-methods.ts` and `parser.ts`. A coverage inventory attempt reported 131 findings before the latest bounded fingerprint reconciliation; this record does not claim that broader gate is green.

Final acceptance still needs the follow-up candidate's browser results, reviewed light/dark/narrow captures, and genuine 120 Hz hardware observations. A mean render time below 8.33 ms alone does not prove a complete 120 fps pipeline; neither a material commit nor an artificial rAF clock measures physical input-to-photon latency. Independent platform review and the responsible author's DCO certification also remain required before integration.
