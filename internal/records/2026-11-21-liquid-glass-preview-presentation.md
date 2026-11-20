# Liquid Glass preview presentation and idle work

## Scope and source

Current-user work requests a faster Liquid Glass Button with visuals informed by Apple guidance. This consumer presentation slice starts at `543c8a2990239dec7c08458a902da3f5a97b49dd`. It preserves draft `P-LIQUID-GLASS-BUTTON`, `C-LIQUID-GLASS-COMMAND-INTERACTION-0001` and `C-LIQUID-GLASS-MAIN-COMMAND-TINT-0001`: Base remains the input owner; regular/prominent candidates, same-size geometry, palette and fallback are unchanged. Material source admission and the optical shaders belong to separately coordinated implementation work.

Apple's [Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials), [Color HIG](https://developer.apple.com/design/human-interface-guidelines/color), [Buttons HIG](https://developer.apple.com/design/human-interface-guidelines/buttons) and [rendering-efficiency guidance](https://developer.apple.com/documentation/xcode/improving-your-app-s-rendering-efficiency), retrieved 2026-11-21, inform this treatment: keep functional controls distinct from content, use selective prominence, preserve legibility and stop unnecessary updates. The independently authored backdrop and numeric colors are project choices, not an Apple asset or numeric specification.

## Observed issue and bounded change

Previously, the public Previewer and optical diagnostics shared a background of diagonal stripes and repeated diagnostic text. Every visible scene retained an animation callback, while the background itself advanced only every 120 ms. The text competed with real button labels and the stepped source motion did not demonstrate smooth control feedback.

The internal scene helper now separates `preview` and `diagnostic` presentation. Existing callers that omit the option retain the diagnostic pixels and 120 ms cadence, so established optical fixtures and their thresholds are not silently replaced. The public renderer selects `preview`, as do framework-owned material stages. No new portable Prototype property or package API is introduced.

Public presentation uses a real visible canvas with soft sky light and three curved foreground layers. It is static by default. Resize, DPR and theme changes still invalidate that real source, and the provider continues to reject unrepresented or overlapping content. The change does not manufacture a backdrop behind an obstruction or move optical rendering into website CSS.

Calling the existing internal `pause(false)` on a preview scene enables its explicit dynamic path. That path uses elapsed animation-frame time rather than the old 120 ms step. Pausing, reduced motion, hiding the document or leaving the viewport stops it; resuming starts from the retained phase without replaying hidden time. Renderability is refreshed from layout and appearance events instead of reading the same scene layout twice in every animation callback. Public static interaction and explicit dynamic-source performance must be measured separately.

Button documentation now leads with action hierarchy and practical material/accessibility behavior, with matching Chinese and English guidance. It retains the experimental/unreleased boundary and moves internal acceptance mechanics out of the reader's introduction.

## Executed local evidence and remaining work

The focused happy-dom scene suite adds four discriminating cases: quiet default/no idle callback plus resize; unchanged historical diagnostic pattern/cadence; updates at supplied 8.33 ms frame times in explicit dynamic mode; and pause/reduced/hidden/offscreen/disposal cancellation without catch-up. These exercise the real scene scheduling and lease code with mocked layout and canvas pixels. They are not GPU, native accessibility or physical display measurements.

Before implementation, the expanded suite produced 3 intended failures and 14 passes. The first candidate exposed a test hook-order pollution issue: the new group preceded the existing root cleanup, causing later computed-style mocks to recurse. Moving the group after the established cleanup resolved the test isolation issue. The complete focused suite then passed 17/17, including all pre-existing geometry, source-boundary, borrowed-target and teardown cases. Existing ES2024/esbuild compatibility warnings remain visible in the logs.

Real light/dark screenshots, actual source-linked optical quality, all four Web adapters and measured input/render timings are coordinated separately. Default static presentation is a design and idle-work change, not proof that a dynamic source renders at 120 fps. Synthetic 8.33 ms frame callbacks do not establish display refresh rate, and no 10 ms input-to-photon result is claimed here.

## Independent review repair: LG-REVIEW-001

The independent reviewer found that caching renderability exposed an observation gap: the appearance observer started at the scene's parent, so setting `visibility: hidden` on an owned scene itself left its dynamic callback active. A new regression using real MutationObserver delivery reproduced the finding before the fix: one callback remained scheduled where zero was required. Canvas pixels, layout and frame times remain controlled test inputs; no manual refresh is injected.

The observer now starts at the scene scope and retains the original ancestor chain. The regression covers visible → hidden → visible, a frozen source revision while hidden, one resumed callback without hidden-time replay, and disposal. The existing guarded min-height assignment and source, material and geometry checks are unchanged. The post-fix complete scene suite passes 18/18, including the new observer-delivery regression; these results are separate from the earlier 17-case run.
