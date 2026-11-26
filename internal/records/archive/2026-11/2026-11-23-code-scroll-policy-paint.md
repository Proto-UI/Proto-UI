# Code scroll policy observation — 2026-11-23

The original integrated [browser job 137596891592](https://github.com/Proto-UI/Proto-UI/actions/runs/45146424504/job/137596891592) passed native wheel chaining in the fresh `auto` case and containment in the negative `contain` case. After restoring `auto` on the same PRE, its computed style was correct but fourteen native wheels left the outer scroll position at 785 instead of reducing it by at least 500. The original failure is retained; it does not establish the historical fixed-coordinate acceptance condition.

## Independent native experiment

The retained minimal HTML contains no Proto UI. It reproduces the same PRE geometry, overflow policies, native input count/delta and quiet interval under Chromium 145.0.7632.6 / Playwright 1.58.2. Two fresh contexts, with and without a native pointer excursion, both observed initial `auto` 785→0, negative `contain` 785→785 and restored `auto` 785→785. A separate context adds a real viewport screenshot after policy/layout preparation and before initial measurement in each stage: initial `auto` 785→0, negative `contain` 785→785 and restored `auto` 785→0.

The complete scripts, observations and three original PNG captures are in `evidence/2026-11-23-code-scroll-policy-paint/wheel-minimal-native-evidence.tar.gz`, SHA-256 `7bc88109f17fccdbd07778e6cab0b670ea6132ddd196255fdc9435104ec400a5`. This supports a missing observable paint boundary in this test setup. It does not identify a Chromium internal defect.

## Bounded fixture change

Before each causal measurement, the full browser fixture now saves that real screenshot and its SHA. It keeps the same PRE and geometry, original `contain`/restored `auto` stages, fourteen −220 native wheels, passive event observation, 750 ms quiet interval, 2,500 ms quiet deadline and all original scrolling/focus/identity thresholds. The observation introduces no DOM/style/input mutation. All thirteen existing source discriminator tests pass. An independent source review found no changed input, threshold or oracle.

The full six-case native website replay remains required on the next integrated head. The minimal experiment and source controls alone do not close the original issue or the historical reproduction gate.

## Actual integrated replay

The subsequent [official run 45160120563](https://github.com/Proto-UI/Proto-UI/actions/runs/45160120563), job `137643076626`, completed successfully at `502693304fc8d7509402fdfb586b283681915231`. All six original browser cases and thirteen source controls passed, with zero failures or skipped tests. The browser reports **157.0.8103.78**; this is separate from the earlier minimal Chromium 145 experiment.

The real short PRE chains from document scrollY **785 to 0**, while the negative `contain` policy remains **785 to 785**. Both long-code widths retain **80px** internal scrolling, then **220px** document chaining at the lower edge, and **80px** horizontal internal scrolling. The fresh policy pair also retains its independent contained negative control. No original threshold, wheel count, input amount or time limit changed.

The historical `(700,550)` replay still hits a different element in the present layout. Its outcome is explicitly `not-reproduced`, with `acceptance: false`; the successful diagnostic case does not close that original coordinate condition or the full issue. The native evidence therefore closes the bounded product replay only.

The complete original artifact, including every observation, screenshot and full log, is retained at `evidence/2026-11-23-code-scroll-integrated-native/official-artifact.zip`: **7,910,577 bytes**, SHA-256 **`552d36ea9fabd33c690a2ea04a1dca8e5a3d60a816ad105b5b88904b8b6503d0`**, fifteen safe archive entries. Its exact source digests match the integrated files. The artifact and adjacent receipt preserve the source version and remaining historical boundary.
