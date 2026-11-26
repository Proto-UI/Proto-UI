# Style tint profile 4: reserved semantic-foreground envelope

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and definition

The exact implementation baseline is `6882c82945c1dbe935482055086b6cc88c22ea97`, tree `ea0c768a3ca17e365a82e2bc4661e313063ff501`. `C-FEEDBACK-MATERIAL-0001` and `T-WEB-LIQUID-OPTICAL-0001` remain draft. The profile-specific definition was revised before the implementation. This is a bounded local candidate, not a native or visual acceptance result.

Profile 2 used the fallback fill's luminance as its conservative safe-side bound. Profile 4 derives a reserved envelope from the existing semantic foreground. Enhanced output may cross the original fill luminance and spend some of its former contrast margin. The fill still owns the fallback and supplies 75 percent of the linear-light hue; the admitted optical source supplies the remaining 25 percent. This expressly changes formerly collapsed black/white fill envelopes. Profile 3 identifies a rejected arithmetic candidate; the new identities are `pui-regular-style-tint-4` and `pui-regular-style-tint-contact-4`.

There are two product-file changes:

- `packages/adapters/base/src/material/style-tint-profile.ts`: pure per-frame foreground-envelope derivation, inward float32 conversion, profile identities and the fixed encoded-affine shader map.
- `packages/adapters/base/src/material/program.ts`: one additional private `u_styleTintLuminanceBound` for each static/contact tint pipeline; same-frame uniform writes and stricter actual-byte readback against the same worst foreground.

No Core, Runtime, Compiler, IR, portable author API, source admission, computed-color owner, seed support, preference guard, selected checkmark or neutral shader change is included. `liquid-toggle-tint-probe.ts` and the existing thirteen-scenario Toggle browser test change only profile identity strings. No new browser fixture or workflow is added.

## Fixed mathematical scheme

The per-channel foreground interval is the governed semantic value plus/minus `1.5/255`, clamped to the legal channel range. Its darker endpoint is used for light text and its brighter endpoint for dark text. This models the existing one-code CSS match allowance plus nominal half-code display rounding, not every antialiased glyph edge.

The light bound retains the feasible lower endpoint of exactly 32 bisections of `X + reserve(X) <= U`. The reserve uses a `5.5/255` encoded upward allowance for the existing full shape/black-shadow model, saturation-corrected channel caps, the exact sRGB upper inverse and the decoder join discrepancy. The dark bound uses the fixed linear reserve `0.0675118372261112`. No coefficients, source inputs, palette branches or thresholds were fitted or searched during implementation.

Source code-luma is mapped affinely between encoded envelope endpoints, then decoded for the existing hue normalization with its `2^-12` denominator floor. Host float32 conversion rounds inward. It only addresses uniform representation: it does not bound accumulated highp or mediump arithmetic, including encoding, coverage, shadow and premultiplication. Real byte readback therefore remains mandatory and fail-closed.

Empty or zero-width reserved budgets throw `style-tint-empty-budget`. This can reject nominally admitted pairs near 4.5 that profile 2 could enhance. Likewise, a nominal-foreground-safe byte can fail the widened foreground interval. The tests explicitly retain both effects: black/white fills with foreground gray 0.46 pass nominal admission but have no certified budget; opaque gray 118 with white foreground passes the old nominal check and fails the new interval check. Fixed-matrix old-pass retention is not a universal no-regression or no-extra-fallback guarantee.

## Frame binding, failure and cost

Both tint programs derive polarity, bound and worst foreground from the same `OpticalFrame` pair. The existing sink lease and signature already bind semantic fill/foreground and reject a changed computed CSS string before publication. Tests alternate static/contact rest/held frames with different foregrounds, including unchanged fill, verify every uniform write, and reject delayed paint after a foreground-only semantic update.

Readback requires at least one opaque pixel. Every tint pixel with alpha 250 through 255 must retain 4.5 contrast and the selected polarity against the same worst foreground. Alpha 250 through 254 is composited over both black and white. At alpha 255, the two composites are algebraically identical because `1 - alpha/255` is zero; that duplicate check is performed once. Tests cover all six alpha endpoints on both polarities and preserve same-state fallback on a budget or rendered-contrast refusal. No fallback is counted as successful optical paint.

Opaque tint pixels now receive an additional polarity verification, whose existing helper also recomputes contrast/luminance. The host solver also runs per tinted frame. The duplicate alpha-255 backdrop computation is removed, but no performance non-regression is claimed. Exact-head native evidence must measure the real cost and existing job/runtime budgets. No further unmeasured optimization or timeout change is included.

## Frozen arithmetic results

The tests contain all six fixed palettes, all five original source grids, the 84 combinations of three levels from `[0,32,64,96,128,160,192,224,255]`, and the original 27-cell reorder `(10*i+7)%27`. Both profile-2 controls and profile-4 outputs use the unchanged first-party ROI evaluator after nearest-byte quantization.

- Original 30 cases: 10 old passes, 29 candidate passes, zero old-pass losses.
- Fixed 504 holdout cases: 326 old passes, 504 candidate passes, zero old-pass losses. Exactly 168 added passes belong to the previously collapsed black/white envelopes.
- The old dark-muted `[224,239,254]` cell remains failed. Old span/RMS are `1.83272 / 1.00211`; candidate span/RMS are `7.17568 / 3.91628772181003`. Span 8 and RMS 4 remain unchanged, and this failure is explicitly asserted.
- All twelve original 16/80 checker/band controls pass. Twelve fixed full-amplitude unrelated multicolor noise controls fail structural/reorder gates while their amplitude, changed-area and contrast gates pass.
- The fixed six host bounds reproduce the previously frozen mathematical scheme, then round inward to representable float32. This is a host arithmetic check, not executed shader evidence.

The source mathematical report SHA-256 is `515cb25a5f2fedee585f8032f6eeec9e04b8c08c7c1beaa4394f6139123ccbb9`; its independent mathematical report is `c4da481fca6852b251ded4d5a9d529f3eaaea7c2a3a2064d4c698ec084fb3be2`. The executable matrix is self-contained in `packages/adapters/base/test/web-material-style-tint.test.ts`.

## Local verification and remaining gates

- 397/397 tests pass across twenty material, sink, source, initial-paint, preference, pipeline, arithmetic and unchanged metric/probe test files. GPU/decode calls are mocked where applicable.
- 69/69 existing native-workflow-input and Toggle documentation source checks pass. These do not run the native scenarios.
- Strict TypeScript checking passes for all eight changed TypeScript files and their import closure, including browser source without browser execution.
- Scoped lifecycle authoring validates the one changed catalog entity. Kernel generation remains unchanged and `git diff --check` passes.
- The neutral static kernel and contact derivative are byte-identical to baseline. Their source SHA-256 values are respectively `61fe78127858f4ed3fbcfb48caef815bbcf8c1a8ef36f603deafe7eb3613da44` and `0b1bd7e655c17cf57c24df5fc97e36a0d5955555a70520d56ac547c6cf1095c8`. Sink/source/style/initial-paint and detail-evaluator source bytes are also unchanged.
- Broad prototype-catalog validation reports 536 uncataloged-entry errors outside the changed files; a separate exact-baseline full-catalog comparison was not run. Broad workspace checking reports two missing generated-shadow imports in unchanged shadow-s3/shadow-s4 fixtures; that broader check is not claimed green.

No real GPU, native browser, screenshot, cross-engine or Apple-equivalence claim is made. The unresolved muted deficit, broader palette fallback frequency, actual highp/mediump behavior, source-bound appearance and native timing are still open.

A subsequent controlled native comparison should retain the old Toggle13 and prominent48 journeys unchanged and separately exercise the fixed six palettes/five source ranges with both source layouts, static/contact rest/held/release, neutral/tinted/zero-refraction controls, actual `gl.getShaderPrecisionFormat` reports, uniform writes, actual RGBA, same-foreground checks, opaque and near-opaque/composited safety, interleaving and every fallback reason. A highp-capable CI run does not verify execution of the mediump fallback; that branch remains separately unverified without actual evidence. Freeze its geometry, inventory and source bytes before execution, distinguish post-lighting arithmetic inputs from real backdrop inputs, and partition jobs rather than extending their deadlines. Inspect exact-source current pastel images and hue/selection hierarchy independently of numeric results. This plan adds no fixture and asserts no result.
