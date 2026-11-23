# Liquid private profile 6: bounded source tone

## Scope and observed failure

This is a draft Adapter-private correction for the retained #1050 optical conditions, within Sprint 6. It does not promote the material definition or introduce an author parameter. The governing evidence entity remains `T-WEB-LIQUID-OPTICAL-0001`; the added addressable condition is `CASE-TONE`.

The native four-host prominent-tint run at [`9b6448e339a474bca6a8fbaae4ad8c24c522a84c`](https://github.com/Proto-UI/Proto-UI/commit/9b6448e339a474bca6a8fbaae4ad8c24c522a84c) failed: [Actions run 45013196978](https://github.com/Proto-UI/Proto-UI/actions/runs/45013196978). Its WC first pastel pairs had insufficient tinted detail amplitude while the neutral positive and opaque negative controls behaved as expected. Examples include light Button text output span 7.68159 codes against the unchanged minimum 8, and dark Form Submit text source-change response 3.14316 codes against the unchanged minimum 4. Later source pairs blocked by these failures remain blocked evidence. Neither successful hover shards nor a source-level analysis replace those failures.

The archived eight WC input frames produced identical bytes under the original and sliding-window CPU prefilters. The proposed correction therefore changes the private tint mapping explicitly; it does not attribute these optical failures to a demonstrated prefilter regression. Historical profile 4/5 formulas, the rejected mean-and-clamp experiment and their observations remain preserved.

The integrator froze `49fc3ac3a5df6f6850795f25503940c5a2d0f2e8` (tree `0d8d72af9c46232f38be26f7aaa73ec293b668c0`) as the subsequent profile-5 comparison baseline, including the separately repaired fixture premises. This reference is a comparison input; it does not turn the observed `9b6448e` failures into a completed native baseline run.

## Definition and implementation

The new live identities are `pui-regular-style-tint-6` and `pui-regular-style-tint-contact-6`. Neutral shaders and profile 5's source-budgeted refraction shoulder are unchanged.

After the complete existing opaque-source admission, one optional statistics pass derives channel extrema from the exact source bytes used by either the CPU or opt-in GPU preparation backend. Their weighted encoded-luma range reserves one nominal byte at either end and the complete static/contact lighting bound of 0.21. This is a work interval, not a GPU arithmetic-error certificate.

Let `low` and `r` be the represented interval's lower endpoint and range, and `b = 0.5 / max(r, 1-r)`, with `r` and `b` rounded inward to float32. For encoded tone `t`, the private shader evaluates:

```text
F(t) = t + b * (clamp(t - low, 0, r) - r * t)
```

The equivalent piecewise real-valued slopes are `1 - b*r` outside the interval and `1 + b*(1-r)` inside it. They stay between 0.5 and 1.5; `F(0)=0` and `F(1)=1`. The positive outside slope preserves a brightness difference between constant sources. There is no per-source min/max normalization to a common output and no new flat interval. The final finite-precision clamp and all existing foreground envelope, 4.5 readback, polarity, near-opaque, geometry and ownership checks remain.

The tuple is prepared lazily on first tinted use and cached on the existing prepared-source entry. It shares identity, revision, dimensions, byte view, canvas scope, clearing and retirement with that source. Neutral-only use does not scan. Current alpha admission still runs before using cached facts. No extra texture sample, GPU readback or DOM reference is introduced. Source statistics cost is included in total preparation time and exposed separately by additive preparation counters.

The source scan can stop early only after observing all RGB minima at zero and all maxima at 255; later bytes cannot widen that interval. This optimization does not replace the preceding complete alpha admission.

## Evidence and preserved controls

The independent module oracle checks the finite interval and slopes, continuous endpoints, constant-field brightness changes, near-black/near-white ranges, historical rejected flat clipping, reordered bytes and malformed views. Program tests cover CPU/GPU agreement, neutral-only work, lazy tint upgrade, A→B→A reuse, clear, identity/revision/view replacement and rejection of current nonopaque bytes. The original 30-case and 504-case color matrices retain their original inputs, expected historical results and safety checks; additive bounded-tone comparisons do not lose an originally passing sample. Existing 12 Toggle hues and the unrelated-noise negative control remain.

The actual-browser prominent suite retains all original 48 cases and 1608 planned captures with unchanged structured sources, metrics, thresholds and positive/negative controls. Eight additional cases exercise the real owned source at encoded gray 32→96→160→224→32 for light/dark Button across four hosts. They require current source revisions and hashes, the original 4.5/readback observations, unchanged geometry/foreground/profile, visible source brightness response and return-to-A agreement. Their scope is constant-field brightness; they do not count as a passing spatial-refraction classification. The expanded plan has 56 cases and 1688 captures, or 14 cases and 422 captures per host.

The final receipt now reconciles every planned case and capture after attempting both browser and server cleanup. Missing, interrupted, unexpected, failed and errored entries prevent a completed result. Page errors and cleanup failures are retained. Context close remains inside the corresponding case's error boundary. A selected subset cannot report the complete plan as passed.

Historical profile-4 replay still loads the frozen profile-4 fragment. It admits only the new, explicitly unused source-tone uniform in the profile-6 host schema and records that unused uniform in its receipt. Current profile IDs and shader hashes have been updated; historical reference IDs and fixtures have not.

## Local validation and limits

Focused runs passed 409 unique unit cases across nine files: program 111, source tone 7, style tint 28, sink 149, preference sequence 8, historical tint diagnostic 32, visible refraction diagnostic 40, prominent fixture 9 and prominent metrics 25. These were proportional runs as affected slices changed, not a claim that one full repository suite ran. Scoped TypeScript and changed-scope spec authoring passed. Collection enumerated all 56 native cases; it did not launch a browser.

The ordinary spec command could not start its `tsx` IPC listener in the local environment. The identical authoring checker executed successfully with `node --import tsx scripts/spec/check-lifecycle-authoring.mjs --base 9b6448e339a474bca6a8fbaae4ad8c24c522a84c`. The failed invocation remains part of the local evidence.

The new statistics pass has real cost. A CPU-only diagnostic retained 31 alternating paired measurements after eight warmups for 23 inputs, comparing the first profile-6 scan with its optimized equivalent. All tuples matched exactly. Bounded 1024×512 input p95 decreased from 2.5968 to 2.0190 ms; bounded 1024×1024 p95 increased from 6.3472 to 6.8648 ms. An archived light Button pastel input decreased from 0.5105 to 0.42574 ms. Full-RGB inputs can terminate much earlier, but those observations are not applied to narrower sources. This is a comparison between two implementations of the additional scan, not a profile-5 product performance result. All slow samples remain retained.

Independent source review found no remaining implementation or receipt blocker. Native optical results for profile 6, actual-size visual review, complete frame cost and physical 120 Hz/10 ms acceptance are pending the integrated candidate's separate evidence. No Issue closure, family completion, real-App acceptance or PR-ready inference follows from this local record.
