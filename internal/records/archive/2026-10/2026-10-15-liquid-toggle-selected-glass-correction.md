# Liquid Toggle selected-glass correction candidate

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This declaration is not authenticated model identity, permission, independent review, or acceptance.

## Decision and governing scope

This candidate starts at `5d4de85fb42e72ac924f945d3cc04312607731d8`; its Toggle/material production source is identical to `371225d96eb91c5307720961dbce85e4ffa6c587`. The existing draft `C-FEEDBACK-MATERIAL-0001`, `P-LIQUID-GLASS-TOGGLE`, `T-LIQUID-GLASS-TOGGLE-0001` and `T-WEB-LIQUID-OPTICAL-0001` govern this slice. This record is explanatory evidence, not a replacement normative API.

The user correctly questioned the flat-looking selected state and the necessity of its underline. Apple's [Meet Liquid Glass, 16:31–17:03](https://developer.apple.com/videos/play/wwdc2025/219/?time=991) describes tint as responding to background brightness, hue and saturation; at [17:03](https://developer.apple.com/videos/play/wwdc2025/219/?time=1023), an opaque solid-fill treatment loses the glass character. Apple's [button Toggle style](https://developer.apple.com/documentation/swiftui/togglestyle/button) fills its selected state with tint. These references concern button-style toggles, not UISwitch geometry. [HIG Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles) requires distinguishable state beyond color, but does not mandate an underline. [Button Shapes](https://support.apple.com/en-au/111773) is a separate accessibility setting for identifying actionable text.

Our underline was a Proto design choice. A fixed-space, current-color checkmark is another Proto choice, not an Apple requirement or exact Apple visual reproduction. It is shown for selection in text and icon-only controls, hidden from assistive technology, and always reserves its slot to avoid selection layout shifts. The underlying `aria-pressed` behavior and original slotted content remain Base-owned. Icon-only controls still need an accessible name; the test uses the existing `aria-labelledby` route. An unrelated pre-existing `aria-label` ownership issue is outside this change.

## Why the former evidence was insufficient

The exact `371225d` native evidence passed 12 scenarios, including the existing 11 behavior/fallback/public-page scenarios. That result did not establish Apple's qualitative selected-glass standard. Whole-image color count included boundaries and highlights; fully opaque decoded pixels merely describe a precomposited admitted-source image, and do not by themselves prove or disprove glass.

An independent retained-image audit found just 6 selected inner-ROI colors versus 51 neutral in one same-source light sample, and 8 versus 38 in dark. In the retained dark-detail GPU control pair, applying the new frozen ROI evaluator retrospectively gives output spans 2.072 and 2.052 code-value luma levels, delta RMS 1.510, and zero cells changing by four levels. Source/output correlation exceeds 0.996 and text contrast remains approximately 6.98, demonstrating that correct structure and readability can coexist with unacceptably weak amplitude. This historical 8-pixel chromatic stimulus is supplemental failure evidence, not the new 16-pixel grayscale challenge and not new-candidate GPU evidence.

## Bounded implementation

The opt-in first-party `style-fill` profile becomes `pui-regular-style-tint-2` / `pui-regular-style-tint-contact-2`. It maps the admitted optical result's code-space brightness and linear-light chroma within the existing fallback fill's safe-side luminance bound. It no longer confines every color channel to the former narrow `0.68 + 0.32 * detail` envelope. All lighting still participates; refraction, source admission and contact ownership are unchanged. A normal binary `2^-12` denominator floor keeps both evaluated branches finite at minimum inherited `mediump` precision.

The neutral shader literals, material program guards, allowed sinks, shared policy, Core data shape, Runtime, Compiler and IR do not change. No public arbitrary-color input, DOM color-sampling API, new source registration, or host-owned canvas is introduced. Without tint, the old path remains unchanged. Unsupported, disabled, unknown/restrictive-preference and forced-colors states retain the existing opaque fallback. Source-independent colors remain valid as fallback, not as normal selected-glass acceptance.

The safe-side constraint can still collapse detail for pathological black fill/light text or white fill/dark text. This conservative limitation is explicit; neither this candidate nor its arithmetic tests establish all-palette perceptual quality. Native GPU precision, temporal behavior, real material images and visual review remain separate gates.

## Deliberate old-to-new evidence mapping

- Selected underline assertion becomes a fixed-layout checkmark assertion for text and icon-only controls, with unchanged accessible name/pressed semantics, retained content identity, current-color stroke, disabled/forced-colors visibility and focused outline contrast. No underline is required by default.
- The old per-channel tint bounds become global safe-side luminance and all-pixel text contrast checks. Distinct source chroma at equal code-value brightness must remain distinguishable.
- The old all-pixel blue dominance / near-solid-primary-distance constraint is removed because it rewards flattening. Palette binding, selected profile receipt, source ownership, all-pixel contrast and overall accent direction remain checked.
- Whole-image `>20` colors and existing refraction checks remain supplemental regressions. They cannot grant selected-glass acceptance.
- The separate `inner-content-detail-1` probe adds text-free registered inner-ROI span, spatial correlation, gradient agreement and same-histogram source-reorder response. Its predeclared thresholds and flat/noise/one-LSB/stale/old-envelope controls are documented in `2026-10-15-liquid-toggle-detail-acceptance.md`; none is tuned against candidate screenshots.
- All original 11 native scenarios remain, the previous tint/control algorithm scenario remains, and a new independent detail scenario is added (13 total). The new probe has 32 source/theme/phase records, 16 source-reorder pairs and 96 neutral/tint/zero-refraction attempts, separate from the older 72-record probe and its counters. Failed records and source/output bytes are retained before assertions.

## Validation status at local handoff

The first-party offline regression union passes 660/660 checks across 22 files, including the prior 507-check suite, new metrics/probe tests, both Portal unit suites, Base Toggle, sink/program/source/style/prefs, policy/Core/Runtime and delivery checks. Workflow inputs and public Toggle MDX checks pass 34/34; three changed spec catalog inputs pass lifecycle authoring validation, the generated kernel check is clean, and source-only Astro fixture transformation reports no diagnostics. Source-scoped and browser-source TypeScript checks pass; browser-source checking does not launch a browser. Further validation and independent review results are bound in the handoff manifest.

Initial stale assertion and TypeScript failures were retained and corrected; no failed native result is replaced by CPU data. Broad catalog validation reports 536 errors outside this scoped acceptance and is not claimed to pass. No local browser was launched. Exact-candidate natural CI, all 13 native scenarios, source-bound GPU files, public EN/ZH screenshots, forced-colors focus/marker images and independent visual review are still required. Even a passing new numeric gate will not establish Apple pixel, animation or perceptual equivalence.
