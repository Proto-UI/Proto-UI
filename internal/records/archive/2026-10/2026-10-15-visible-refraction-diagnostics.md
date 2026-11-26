# Visible refraction: spatial and scripted-frame diagnostics

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated identity, permission, independent review, or acceptance.

## Question and evidence boundary

A visible background connection does not by itself show visible refraction. This diagnostic asks whether a recognizable background feature changes spatial position or bends in the current material, separately from uniform magnification, tint, blur, illumination and shape changes. It is a test-only increment. The production programs, palette envelope, foreground safety, source admission, component behavior and existing optical acceptance criteria remain unchanged.

The applicable draft definitions remain `C-FEEDBACK-MATERIAL-0001`, `C-LIQUID-GLASS-MAIN-COMMAND-TINT-0001` and `T-WEB-LIQUID-OPTICAL-0001`. No new product guarantee or Apple-derived numerical threshold is introduced.

## Official qualitative reference

Apple describes lensing as background light being bent, concentrated and distorted, with strength adapting to context and size. The following frames of [WWDC25 Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) make this distinction visible:

- [2:29](https://developer.apple.com/videos/play/wwdc2025/219/?time=149): the straight horizontal background boundary before the glass capsule appears.
- [2:34](https://developer.apple.com/videos/play/wwdc2025/219/?time=154): the boundary bends and narrows inside the capsule ends.
- [2:44](https://developer.apple.com/videos/play/wwdc2025/219/?time=164): flower and blue-background features are spatially rearranged inside the glass.
- [7:15–7:16](https://developer.apple.com/videos/play/wwdc2025/219/?time=435): a toolbar expands into a menu; flower lines visibly bend during the transition. Some foreground text also changes shape temporarily. This is not evidence for a general prohibition on animated foreground deformation.

These are official presentation frames, including illustrative rendering, not calibrated operating-system measurements. Their pixel displacements, animation times and apparent strengths are not project thresholds. [HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials#Liquid-Glass) and [Adopting Liquid Glass: Controls](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass#Controls) also require attention to context, readability and accessibility. They do not prescribe one universal refraction strength.

## Exact preceding source and causal audit

The observed source is `2b8757f4516da60d3a3b31e9ec4df7401b3d3195`, tree `bf899df185407f326a43dca40f2a65f9a20dcab0`, [run 38799513893](https://github.com/Proto-UI/Proto-UI/actions/runs/38799513893). Each runtime prominent suite has 8 passes and 4 failures. Light Submit passes the existing optical tests; light Button and dark Submit retain structure/response failures. Dark Button's weak neutral reference is inconclusive. Original Toggle 13, public Dropdown 16 and hover 16/16 pass at that source. Those results do not prove visible refraction or apply to this unexecuted diagnostic.

For the archived React light/dark normal-text Submit idle material, a first-party numerical reconstruction matches each captured 9,552-pixel opaque carrier exactly. This validates a model of those two draws; it does not observe intermediate GPU registers or establish visible human perception.

At the actual 261.328125 × 38 CSS-pixel geometry:

- The prior interior-content ROI has mean nonuniform warp about 0.0123 CSS px; 86.1% has zero warp and 99.7% is below 0.5 CSS px.
- The entire opaque shape has a peak of about 21.937 CSS px. The 0–1, 1–2, 2–4 and 4–8 CSS-pixel edge-distance bands have mean modeled warp about 19.630, 10.309, 2.800 and 0.578 CSS px respectively. The 0–1 band here excludes antialiased pixels, so it samples only the fully opaque portion.
- Strict warp removal changes the content ROI by only about 0.094 light / 0.047 dark RMS 8-bit codes, versus 2.866 / 1.021 over the complete opaque shape. These are model counterfactuals, not newly rendered GPU controls.
- The regular lens edge field reaches zero at 8.36 CSS px inward. Uniform magnification remains in the center and can move a straight line without bending it.
- Offset is expressed in whole-source UV. Its CSS displacement depends on the admitted source rectangle as well as the host geometry; source-size normalization would require a separate geometry-contract decision.

Thus the small interior average does not describe the narrow rim peak, and the peak does not establish broad visible bending. Simply increasing the existing peak is not a justified correction. The dark tint's tone compression can also reduce visibility independently of spatial displacement.

The archived idle/hover/release/leave carriers are byte-identical. Pressed frames change, but combine shape, magnification, illumination and warp. They do not supply a held-drag trajectory or continuous release evidence.

## Test-side design

The new route uses the unchanged first-party material renderer and owned fixed source images. Eight fixtures cover normal-text Button and Submit geometry, light/dark palettes, and two source classes: archived ordinary background and a predeclared straight-line/landmark pattern. It does not claim icon-only, component, four-runtime or DOM source-admission acceptance.

For each fixture, seven scripted renderer states cover rest, press, held, drag-held, release, restored rest and a final isolated 6-source-raster-pixel shift (converted to CSS units from the actual source rectangle in each receipt). Each scripted frame runs in a fresh page. The recorded times describe chosen renderer inputs; they are not measured native pointer timing, frame rate, continuous animation or a real component interaction. A separate fixed-static-profile pair is a renderer control, not proof of preference detection or policy admission. Existing component and preference suites remain authoritative.

Each same-input pair preserves source, geometry, float32 uniforms, prepared texture, opacity shape, magnification, tint and lighting. On the diagnostic's own canvas only, an exact checked shader anchor replaces `offset` with zero. This also removes its chromatic displacement while retaining the original channel-sampler branch. It does not isolate chromatic dispersion from achromatic warp. The existing `zero-refraction` and `zero-aberration` controls are shown only as explanatory multi-factor comparisons because they also alter magnification or channel sampling.

The correspondence metric uses normalized local structure, ambiguity rejection and forward/backward agreement. A best affine fit removes translation, rotation, scale and shear before non-affine residual is reported. Identity, affine, tint/brightness, blur, noise and insufficient-texture controls prevent a generic image difference from becoming evidence of bending. A known spatially varying positive control calibrates sensitivity independently of the actual material images.

The 0–4 CSS-pixel rim is outside the independently resolved correspondence-center support and remains explicitly unmeasured as its own band; the larger local patches can overlap some rim pixels. Sampled center-depth ranges and inconclusive bands are retained. A result with no resolved non-affine displacement must never be generalized to the whole control. Full native images retain the rim for visual inspection.

Native material PNGs are decoded before compositing into synthetic source contexts; premultiplied readback is not alpha-composited a second time. These contexts contain no rendered component label and are labeled synthetic. Raw bytes are used for opaque-region metrics and actual foreground contrast/polarity checks. The exact bottom-up premultiplied RGBA8 readback is separately retained in lossless gzip files, with its uncompressed transfer hash verified before storage; display PNGs are not substituted for these raw bytes. Contrast below 4.5 or any existing safety failure remains blocking.

## Collection, limitations and next decision

The collection is bounded to 64 frame records and 144 material draws, with a 12-minute collection budget inside its own 20-minute CI job. The four existing job definitions and their original budgets remain intact. Exact candidate head/tree, original-source identities, image hashes, shader hashes, uniform observations, partial failures and a terminal checkpoint are retained. The budget bounds collection scheduling and page evaluation, not animation timing. Ordinary failures and termination signals update the checkpoint; an abrupt runner loss or SIGKILL may leave a running checkpoint, which remains unknown rather than completed. `productAccepted` remains false even when all diagnostic cases execute successfully.

No product prepass, readback, texture tap, statistic, uniform, transfer, public property or runtime capability is added. A future minimum product proposal could investigate a wider bounded low-frequency lens transition while preserving the sharp rim's peak. It must first be justified by these native controls, keep label/icon readability and source admission safe, retain every existing foreground/palette regression, and separately examine ordinary backgrounds. Such a proposal is not implemented here.

Local non-browser checks pass for workflow/MDX (86), runtime inventory/shared-shard exclusion (125), official preset checks (12) and the material kernel generation check. The largest fixed normal Submit carrier uses 88 predetermined correspondence centers; one same-image CPU check took approximately 466 ms on Node 24.19. That is a local matcher cost observation, not browser performance or material evidence. Pure control calibration passes 17/17, including numeric ±4 CSS-pixel calibration at DPR 1 and 2 and affine/brightness/noise/blur negatives. Focused TypeScript and Astro transform checks report zero diagnostics. Separate esbuild closure checks produce a 64,152-byte diagnostic entry and a 96,433-byte material entry; the material entry has no diagnostic input. These are focused checks, not a complete website build or package-budget result. Independent review is recorded with the candidate handoff. Fresh native same-input pairs and scripted frames remain pending. The current product's actual visible-refraction, ordinary-background and optical failures remain open.
