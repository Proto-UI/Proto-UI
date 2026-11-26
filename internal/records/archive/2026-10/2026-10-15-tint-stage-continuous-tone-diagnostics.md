# Tint4 stage and continuous-tone diagnostics

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated identity, permission, independent review, or acceptance.

## Purpose and governing boundary

This increment adds a test-only causal diagnostic. It does not change the current `pui-regular-style-tint-4` / `pui-regular-style-tint-contact-4` product mapping, its safe foreground envelope, or the draft requirements in `T-WEB-LIQUID-OPTICAL-0001` and `C-FEEDBACK-MATERIAL-0001`.

The direct background connection of tint is a qualitative Apple design goal: [WWDC25 Meet Liquid Glass, tint](https://developer.apple.com/videos/play/wwdc2025/219/?time=991) and [solid-fill comparison](https://developer.apple.com/videos/play/wwdc2025/219/?time=1023). The project's numerical thresholds are engineering criteria, not Apple pixel or motion specifications. An aggregate metric pass does not establish visual quality.

## Exact preceding result

Source commit `2b8757f4516da60d3a3b31e9ec4df7401b3d3195`, tree `bf899df185407f326a43dca40f2a65f9a20dcab0`, [material evidence run 38799513893](https://github.com/Proto-UI/Proto-UI/actions/runs/38799513893):

- Each of the four runtime prominent suites has 8 native passes and 4 failures; all 12 behavior cases and all 4 preference cases pass.
- Light Button text/icon and dark Submit text/icon retain real optical amplitude or phase-response failures. Light Submit passes. Dark Button pastel remains inconclusive because the neutral reference is weak, although its raw source is informative. Sources after a failed assertion are not treated as collected.
- Original Toggle 13 and public Dropdown 16 pass. Hover 16/16 and 2880 observations pass. Those results apply to that published source, not a diagnostic candidate.

The official optical metrics use the captured interior material plane. Independent subject screenshot measurements retain the substantive failures with different numbers. Neither plane replaces the other selectively.

## Causal evidence and rejected research control

Sixteen archived pastel/contact/rest frames were reconstructed from their owned source images and exact geometry. Of 292,464 opaque RGB channels, only 4 differ from the archived GPU carrier, each by one code. This is strong model validation, not direct measurement of intermediate GPU values. It covers rest, not all held or static behavior.

There is no double tint or pre-map clamp in those frames. The dominant contraction is the current white-foreground encoded-affine slope, approximately 0.428108; filtering/refraction and the blue hue mapping contribute additional changes. Button and Submit have different real geometry and source ROI coverage.

A single predeclared mean-anchored unit-slope arithmetic control improves the recorded tinted-only CPU structure diagnostics from 2/8 to 8/8. The original 30-case matrix changes from 29 to 30 passing cases; all 504 holdout and all 12 old synthetic Toggle controls remain passing, with no old pass lost. These numbers are not native three-control acceptance. In particular, dark Button's neutral result remains inconclusive.

That control is **rejected analytically as a general transfer**. Its input range can be wider than the safe output range, so clipping creates constant-tone intervals. In the fixed 504 grid, 476 cases acquire target clipping, reaching 23/27 samples in one case. Gradient cosine can decline from 0.87747 to 0.63133 while remaining above the existing 0.6 gate. Existing aggregate gates therefore do not rule out this local loss. In the real-frame model, 67 pixels acquire high-end clipping; one 33-pixel connected area becomes one RGB where the old path had three values separated by only one code. This does not by itself establish a large visible defect, but it makes the missing distinction concrete.

A successful diagnostic test means it detected its expected rejected control. It must never label that control as a production-ready material.

## Diagnostic requirements

- Use only owned fixed source images and predeclared continuous grayscale ramps. Keep source hashes, geometry, profile, actual uniforms, head/tree and image hashes in the evidence. Historical input images are identified as inputs, never presented as fresh candidate screenshots.
- Observe the actual prepared texture and uniforms of the renderer on the diagnostic's own canvas, then replay them on a separate diagnostic canvas. The replay must match the same-frame unchanged production readback before stage results are used. Do not replace this with a fitted CPU reference. This directly constructs the fixed `OpticalFrame`; it does not repeat DOM or provider source admission, which remains covered by the original component jobs.
- Derive finite test-only shader taps with exact replacement-anchor checks. Record bounded postlighting signal, binary fully opaque shape mask, low/high target-clamp flags and output. The shape mask is not inferred from rounded final alpha 255. Derived shader taps may change compiler optimization because of their early returns; they are separate shader observations, not access to hidden registers of the original production draw.
- Distinguish normal 8-bit quantization from a clipped continuous interval. Equal RGB alone is insufficient: require varying input, previously ordered target tone, the new endpoint-clamp cause and adequate measurement precision. An unresolved precision interval is inconclusive, not success.
- Keep actual foreground 4.5/polarity safety and source binding checks. The diagnostic mean is only a same-frame test input, never a new production statistic, cache, uniform or public author parameter.
- Keep a terminal checkpoint and all partial/failure evidence. A separate bounded CI job preserves the original component evidence jobs and their deadlines. Analytic rejection is separate from observed GPU status: the final native rejection requires all 28 GPU cases to complete and all four full-domain ramps to confirm both endpoint vetoes; blocked, failed, partial or unconfirmed collection remains `incomplete-native-diagnostic`.

## Validation status

Local checks for this test-only increment:

- Related pure tests: 71/71, including 30 stage-diagnostic cases, 17 existing style-tint cases with the frozen 504 matrix, and 24 existing optical metric cases.
- Workflow/MDX checks: 80/80. Runtime inventory and shared-shard registration: 125/125. The original unregistered-suite failure is retained in the review evidence; registration now assigns this suite only to its dedicated workflow.
- Official preset generation checks and their 12 palette tests pass. Focused strict TypeScript and the Astro route transform pass. No generated product artifact changes are included.
- Separate esbuild dependency-closure checks produce a 77,093-byte diagnostic entry and a 108,768-byte production material entry. The latter has 62 inputs and none is diagnostic code. These are standalone checks, not a full website bundle measurement.
- The full website build stops before Astro at the existing CLI dependency resolution: `prompts` cannot be resolved in `packages/cli/src/services/interactive.ts` in this local dependency layout. A successful complete website build is not claimed.

The planned native collection has 28 fresh GPU cases (16 frozen-frame replays and 12 continuous ramps) plus 32 explicitly historical neutral/opaque references. Only the separate unchanged component jobs provide fresh three-control component acceptance. The new diagnostic job makes ten specialized jobs; the prior nine jobs and their limits are unchanged. It persists source identities, stage images, raw production/replay hashes, precision observations and terminal checkpoints. Native diagnostic evidence is not yet collected for this increment. Current product optical failures remain open. No production mean calculation, additional draw/readback, interface or transfer change is included. Any future product proposal needs its own sampling, precision, performance, lifecycle and real GPU evidence.
