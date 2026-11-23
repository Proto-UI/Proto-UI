# Code scroll policy observation — 2026-11-23

The original integrated [browser job 137596891592](https://github.com/Proto-UI/Proto-UI/actions/runs/45146424504/job/137596891592) passed native wheel chaining in the fresh `auto` case and containment in the negative `contain` case. After restoring `auto` on the same PRE, its computed style was correct but fourteen native wheels left the outer scroll position at 785 instead of reducing it by at least 500. The original failure is retained; it does not establish the historical fixed-coordinate acceptance condition.

## Independent native experiment

The retained minimal HTML contains no Proto UI. It reproduces the same PRE geometry, overflow policies, native input count/delta and quiet interval under Chromium 145.0.7632.6 / Playwright 1.58.2. Two fresh contexts, with and without a native pointer excursion, both observed initial `auto` 785→0, negative `contain` 785→785 and restored `auto` 785→785. A separate context adds a real viewport screenshot after policy/layout preparation and before initial measurement in each stage: initial `auto` 785→0, negative `contain` 785→785 and restored `auto` 785→0.

The complete scripts, observations and three original PNG captures are in `evidence/2026-11-23-code-scroll-policy-paint/wheel-minimal-native-evidence.tar.gz`, SHA-256 `7bc88109f17fccdbd07778e6cab0b670ea6132ddd196255fdc9435104ec400a5`. This supports a missing observable paint boundary in this test setup. It does not identify a Chromium internal defect.

## Bounded fixture change

Before each causal measurement, the full browser fixture now saves that real screenshot and its SHA. It keeps the same PRE and geometry, original `contain`/restored `auto` stages, fourteen −220 native wheels, passive event observation, 750 ms quiet interval, 2,500 ms quiet deadline and all original scrolling/focus/identity thresholds. The observation introduces no DOM/style/input mutation. All thirteen existing source discriminator tests pass. An independent source review found no changed input, threshold or oracle.

The full six-case native website replay remains required on the next integrated head. The minimal experiment and source controls alone do not close the original issue or the historical reproduction gate.
