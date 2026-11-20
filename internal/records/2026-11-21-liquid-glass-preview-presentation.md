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

## Public Button spacing repair from native evidence

CI run `44799728866` recorded the public Button page at candidate `9d5a3881deb193c4d4aa30fe88ee08bed401e8e8`, with light/dark 1440 × 1050 views and a light 390 × 844 view. Its `candidate/report.json` reports a committed `self-optical` Back button in all three views, while Continue reports `opaque-fallback` with `source-overlapping-content`. The baseline has the same Continue defect; the calmer presentation did not create it. Disabled Unavailable correctly has no active material candidate.

The measured Back and Continue hosts are 73.125 × 38 and 98.046875 × 38 CSS pixels. Their production contact outsets are 7 and 9 pixels. The authored 12-pixel gap therefore leaves their full paint/sampling boxes overlapping by 4 pixels. The source guard correctly refuses to invent a canvas-only backdrop through the neighboring carrier.

The bounded correction changes the real DemoSpec's gap from 12 to 24 pixels on both flex axes. It preserves every button's dimensions and behavior, scene width, source guard and shader. The two active controls gain 8 pixels of clearance; even reserving the disabled control's complete potential 11-pixel outset leaves 4 pixels between the largest adjacent footprints. The 18 Chinese/English code-template spacing literals receive the same change without reformatting their templates. Those templates show individual WC/React/Vue buttons, while their live previews use the common DemoSpec; template consistency is not a separate native rendering result.

The new layout-budget regression compiles the actual Tailwind utility, uses the production `contactPaintOutset` and checks the native-observed dimensions. Before the change, its two clearance cases failed with −4 and −8 pixels while its narrow-width budget passed. Afterward all 3 cases pass; the existing transparent public-carrier style check also passes, for 4/4 focused tests. These are authored CSS and arithmetic checks, not a simulated native flex layout or post-fix optical acceptance. A new real CI capture must confirm both active controls have actual optical paint, prominent tint remains readable, and narrow wrapping has no overlap.

Independent inspection of the original candidate's light viewport, dark/narrow component images and baseline light image finds less visual competition from the backdrop: the diagnostic lettering and high-frequency stripes are gone, and the English labels remain legible in the inspected views. Continue is visibly flat in those images, consistent with its fallback diagnostics; those images cannot establish the corrected prominent material. Chinese text in the viewport capture appears as missing-glyph boxes in the CI environment, so this run cannot establish Chinese typography or reading quality. This repair makes no Apple equivalence, physical refresh-rate or input-to-photon claim.

## Second native browser observation

[CI run 44802914287](https://github.com/Proto-UI/Proto-UI/actions/runs/44802914287), candidate `85b55f2f520e39c61c0236e41a8533d242674244`, completes the post-fix public check. In light, dark and 390 px views, both Back and Continue have committed owned optical paint with matching geometry; Continue reports `pui-regular-style-tint-contact-5`. Unavailable has no optical carrier and its sampled image is exactly `none`. The strict comparison passes without weakening source overlap admission.

The same Noto CJK/fontconfig packages are installed before both baseline and candidate. Independent inspection of all three public views and Chinese viewport captures confirms readable glyphs, a quieter backdrop and clear action labels. On the narrow page the enabled pair fits on one row, with Unavailable and the status occupying subsequent rows; no overlap or clipping is observed. In this font environment the button widths are 73.953/101.891/119.484 px and their paint outsets are 7/10/11 px. Thus the actual 24 px gap provides 7 px of enabled-pair clearance and 3 px for the largest hypothetical adjacent footprints. The earlier 8/4 px budget remains a historical calculation using the first runner's font geometry.

All four adapter fixture journeys show real held optical paint, return to rest and produce one activation. Those are pointer smoke checks on the diagnostic fixture, separate from the default-WC public visual captures; they do not establish all-runtime latency, keyboard/touch acceptance or physical display timing. The [frame-budget record](./2026-11-21-liquid-glass-frame-budget.md) retains the exact run, artifact identity, performance results and remaining acceptance limits.
