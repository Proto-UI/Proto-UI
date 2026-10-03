# Liquid Glass and Bootstrap 2.3.2 projection foundation

Observed baseline: `fedbe05a`, 2026-10-03. Work: [#792](https://github.com/Proto-UI/Proto-UI/issues/792). This is an implementation record, not a new material, Base or cross-host guarantee.

## What the first increment does

Two private, unreleased source packages define real Base-inheriting Button Prototypes. Bootstrap 2.3.2 retains default/primary raised-control colors, vertical gradients, inset highlights/pressed shadows and 4px corners. The Liquid Glass package currently carries only the explicit opaque, non-moving fallback: capsule functional controls, paired light/dark colors and focus treatment. This fallback is useful prerequisite work; it does not complete the requested translucent effect or family coverage.

Both use `asButton()` and consume Base state handles through `def.rule`; they do not reimplement click/focus/disabled ownership. The independent `/en/test/new-projection-families/` fixture uses four real Web adapters and contains no selectors that repaint a Prototype surface. The existing homepage/family registry remains unchanged until advertised component/part coverage is ready. In particular, this work does not indefinitely extend #777.

## Current expression and realization matrix

| Concern | Author-side protocol / implementation | Web translation | Rust/GPUI translation |
| --- | --- | --- | --- |
| Surface color, alpha, opacity | `C-FEEDBACK-STYLE-0003` draft style-token intent; finite color/opacity vocabulary | Generated scoped CSS, including color alpha | `native/gpui/crates/proto-ui-style` resolves colors; GPUI mapper handles background-color/color/opacity, subject to supported values |
| Radius, font, spacing | Current finite token vocabulary; consumer owns font resource | Finite supported utility translation and native-control normalization | Mapper handles border-radius, font-size/weight/family, line-height and supported lengths/layout |
| Soft/inset shadow | Existing shadow token group; this increment adds two finite Bootstrap values | Real composed CSS box-shadow | `box-shadow` currently unmapped; no blanket visual parity |
| Vertical gradient | This increment adds two finite controlled tokens; one bg intent includes image plus fallback color | Explicit background-image + background-color; flat interaction tokens explicitly clear image under selector lowering | `background-image` currently unmapped; a fallback fill is not a gradient-parity pass |
| Background blur | Existing `backdrop-blur-xs` maps to 4px blur | Browser implementation dependent | `backdrop-filter` currently unmapped |
| Refraction, backdrop-adaptive brightness, moving highlight, morphing | No governed portable material contract found | Not implemented by these families | Not implemented by these families |
| Light/dark | Existing family variables and accepted colorScheme use | Host theme variables; `C-RULE-COLOR-SCHEME-0001` mounted invalidation | Bounded existing theme machinery; new family theme admission/evidence not complete |
| Reduced motion / transparency / contrast | `M-RULE-META-0001-A` explicitly leaves non-colorScheme keys sampled; transparency/contrast reader absent | No honest new reactive guarantee from merely adding a getter | Needs explicit host/wire ownership, not a frame-time JS query |

The GPUI implementation is real and must not be described as absent: `native/gpui/crates/proto-ui-gpui` has style, input, focus, layout and Button T0 tests. Several early README statements lag that implementation. There is still no `A-GPUI-*` profile and these two families have no collected GPUI conformance evidence. Mapping a property or reading a shared style fixture is not a complete family/host result.

Four official Web profiles exist. No Flutter or Qt adapter/profile/backend is present in this baseline. Prototype Compiler work remains the restricted-TS Button lane in #732, with native-mixing/lifecycle work in #733. CLI token extraction/CSS generation is a different path and cannot be called a general Prototype Compiler.

## Why the first glass effect is not enabled yet

[Dependency #793](https://github.com/Proto-UI/Proto-UI/issues/793) proposes a bounded reactive accessibility-preference source and separate host style-support facts. `C-RULE-COLOR-SCHEME-0001`, `HC-COLOR-SCHEME-INVALIDATION-0001` and `RuleMetaModuleImpl.reconcileLease()` are deliberately colorScheme-only. Adding a `reducedTransparency` getter would not make live changes reactive. No Base Button change is needed; the unresolved decision is environment/material capability ownership, values and lifetime.

The recommended progression is to preserve that contract, add a separately reviewed bounded preference/support capability, and enable the existing blur/alpha subset only when both support and preference input are affirmative. Unknown or reduction-requested input chooses the readable opaque fallback. Full optical material semantics and #495's geometry/value-motion proposals remain separate. A family-local DOM/media-query observer would conceal the portability defect rather than resolve it.

Apple's [Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials) places the material in the functional/navigation layer, recommends restrained use and legibility, and distinguishes regular/clear variants. Do not glass-coat content or the entire gallery. The project must not copy Apple's private assets or imply native Liquid Glass equivalence.

## Bootstrap 2.3.2 boundary and source notices

Pinned sources: [archive](https://getbootstrap.com/2.3.2/), [buttons.less](https://github.com/twbs/bootstrap/blob/v2.3.2/less/buttons.less), [variables.less](https://github.com/twbs/bootstrap/blob/v2.3.2/less/variables.less), [license](https://github.com/twbs/bootstrap/blob/v2.3.2/LICENSE). Code is Apache-2.0; the package retains attribution and the full license. No legacy jQuery/plugin runtime, Glyphicons or upstream documentation prose is bundled.

The first Button subset is explicitly narrower than 2.3.2: default/primary only; spacing scales with a 16px root rather than promising all fixed-pixel parity; stronger focus-visible ring; omitted text-shadow, lower-edge border tint, gradient-position animation and additional sizes. Bootstrap 2.3.2 has no standard dark palette; the archived palette stays fixed inside a dark host. Future dark variants must be described as extensions.

## Evidence and remaining work

Local checks: focused Prototype/CSS tests, source-token closure, catalog, workspace TypeScript, public-manifest/release metadata and generated agent projection checks. The original CSS translator reports the new Bootstrap token set unsupported; the candidate closes it. These results prove bounded source/translation behavior, not rendering.

The local browser launch was blocked by the restricted process environment and the escalation environment failed before launch; no local browser pass or fabricated screenshot is claimed. A contents-read-only, exact-head GitHub Actions workflow runs the real four-runtime fixture and records public screenshots and source/browser/toolchain metadata. Browser status remains planned until that execution is inspected.

Remaining: real browser acceptance and independent review of this increment; actual glass enhancement after #793's decision; further Base-backed component/part projections and homepage/library/demo integration; #732/#733 Compiler conformance; #687 GPUI mapped-subset work and actual native evidence; separately governed Flutter/Qt backends. #792 remains open for the full outcome.
