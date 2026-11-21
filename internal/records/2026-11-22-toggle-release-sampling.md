# Toggle release sampling correction

The native [material job in cycle 44945602403](https://github.com/Proto-UI/Proto-UI/actions/runs/44945602403/job/136972650738), bound to `e775cd5448b3ab13ebe08b051121fda3508de5e9`, completed all 28 files with 909 passed and 28 failed assertions. Eight Toggle runtime/theme scenarios reached the original stationary raster-size comparison and failed there. This record preserves that failure and corrects the observation precondition; it does not claim a subsequent native pass.

## Native observation and intended boundary

In the WC/light sample, the inactive material raster was 89 by 38 pixels with zero paint outset. After pointer-up, `aria-pressed` was true and the semantic material phase was `rest`, while the committed provider receipt still reported `contact=release`. The host remained 88.953125 by 38 CSS pixels, but its independently verified contact carrier retained a 9-pixel outset and a 107 by 56 raster. The other seven runtime/theme cases reached the same comparison during release. The original dimensions are retained in the companion JSON, with exact native file hashes and the artifact identity.

The existing `createContactMotion` explicitly retains a finite 240-millisecond release tail and its expanded paint box. The draft `P-LIQUID-GLASS-TOGGLE` distinguishes persistent selection from transient press deformation, and `T-LIQUID-GLASS-TOGGLE-0001` requires preservation of the original input, geometry and cleanup assertions. Semantic phase `rest` alone therefore does not prove that the physical carrier has returned to its stationary geometry.

The browser test now retains an immediate `released` capture, waits for the existing committed `data-material-contact` diagnostic to reach `rest`, and then performs the original `active` capture and all original assertions. The frozen active snapshot additionally must report `receipt.contact=rest` and `paintOutset=0`. The test does not require that every machine observe an intermediate release frame: a tail that has already completed is valid. It still rejects a tail that never settles within the existing bounded poll.

## Preserved assertions and actual local checks

Before commit formatting, removing the seven added lines reproduced the previous test file byte for byte. The commit hook subsequently reflowed two existing `bare.evaluate` calls. Removing the same intended additions from the formatted file yields an identical canonical TypeScript AST to e775; no original expression or operation changes. All 243 existing `expect` call occurrences remain in order; three assertions were added. The default poll limit and 120-second case limit are unchanged, as are raster-size equality, host geometry, source, optical contrast, input, controlled-state and fallback requirements. No product implementation or contact duration changes in this correction.

The focused local command ran the existing contact-motion, Toggle snapshot and Liquid Toggle prototype tests: **63 passed across three files**, exit 0. The existing localized Toggle MDX controls separately passed **2 of 2**, exit 0. Both receipts record actual command times, exit codes and unchanged source-patch hashes during execution. These source and simulated-host controls do not execute native browser input or validate optical output.

The browser test path is not among the candidate coverage matrix's bound source references; the correction does not renew unrelated fingerprints. Any accompanying production-source correction must be bound separately through the real generator. The final corrected candidate still requires its own complete native cycle. The e775 results remain attached to e775 and are not replaced by this local success.

See [the machine-readable receipt](2026-11-22-toggle-release-sampling.json) for all eight native observations, preserved source hashes and actual local logs. No lifecycle, website acceptance or platform conformance state is promoted.

The final formatted Toggle file SHA-256 is `07104c98b357d8d53573569fd99e194511ed0f0d9034fe8f620798d26ca25700`. The formatting audit is retained in the companion JSON and was independently confirmed. The existing type-check receipt covers the equivalent pre-format source, while the final native cycle must execute these exact committed bytes.
