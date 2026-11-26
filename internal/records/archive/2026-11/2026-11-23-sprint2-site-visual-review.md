# Sprint 2 site evidence: independent visual readback

This is a bounded review of the original hosted Sprint 2 run `45146671689`, job `137597556472`, at clean source `d0392fb31513b12f55b9e99b1fcf26a6338569c9`. It does not accept a later integration revision or close the parent issues. The original run passed all 304 selected functional cases, including 42 site cases, and failed its workspace type stage. A functional pass is not an independent visual review.

## Inputs and method

Original artifact `14805214684` has SHA-256 `0ccd23e09406b369d3225015b599aacee721d8c15e0f5ff7ca1c30ee3c975eed`. Its 84 site PNGs have paired JSON observations binding them to the clean source, Chromium `157.0.8103.78`, route, viewport and actual document theme.

The [manifest](./evidence/2026-11-23-sprint2-site-visual-review/manifest.json) records every original PNG/JSON digest. The [review input bundle](./evidence/2026-11-23-sprint2-site-visual-review/review-inputs.tar.gz) contains every paired JSON, ten contact sheets with exact unscaled crop coordinates, and eight representative original full frames. All 82 target regions in the contact sheets and both original full-frame Hook captures were actually inspected. The full source screenshots remain unchanged in the original artifact; the contact sheets are reading aids, not replacement captures. Fixed Tabs crop coordinates partly omit the profile buttons in the Chinese WC/Vue frames; the Chinese WC full frame was additionally inspected.

## Observed result

| Surface | Original images | Independent visual observation | Retained limit |
| --- | --: | --- | --- |
| Tabs | 24 | Both locales, four runtimes and three named profiles display the selected Password tab and its matching content. The shown profile differences are visible and the scoped text is readable. | The paired native checks establish retained tab/panel/child identity and focus. An image alone does not. Several Rhea captures are transitional: English WC records a `13.5648px` radius. The test reuses capture IDs, so the retained Rhea/Nova images overwrite earlier captures. These images do not establish settled final profile geometry or unsupported-profile behavior. |
| Desktop Sidebar | 32 | Both locale/theme combinations retain readable group/leaf hierarchy, distinct current paint, group hover and visible keyboard focus in enhanced and failed-script captures. | Same-mode group/leaf radii agree, but the Brutalist fallback is square (`0px`) while enhanced paint is `5px`. The original assertions do not establish cross-mode family equivalence. Preserve this as a real unresolved presentation difference. |
| Mobile Sidebar | 8 | The selected leaf remains legible at 390px in both families and both languages. The supplied observations record 44px native targets and all four ownership hit points. | Group and leaf are scrolled/measured separately; the final screenshot is not simultaneous proof of both. Enhanced captures are light; no-JS captures actually have `data-theme=dark` despite the requested light color scheme. Do not label them as light fallback coverage. The square Brutalist fallback versus rounded enhancement remains visible. |
| Hero pill | 18 | Both locales, both themes, enhanced and failed-script hover/focus show the pill without the ordinary text-link underline. Focus surrounds the outer pill without a second child ring. Two English light forced-colors captures retain a visible perimeter. | Forced-colors evidence is only the two recorded English cases. This read does not establish all page visuals, physical keyboard/AT behavior, or unrecorded themes. |
| Hook history | 2 | Both locale pages visibly retain the actual bounded R3 failure, missing module declaration array, exit 1, and the statement that all 13 retained generic conditions remain unearned. Text and evidence links are readable. | A correct historical link is not execution or acceptance of those 13 conditions. The historical R1 vacuous pass is not upgraded. |

The full English Hero frame also shows an unrelated analytics-card label wrapping `Review` across two lines. That is outside the pill acceptance and is not silently included in a claim that the whole homepage is visually complete.

## Work still required

The final integrated source must rerun the original site selection and receive its own independent visual read. The Tabs evidence needs a read-only settled capture boundary if it is to substantiate final profile geometry. The Sidebar fallback must be assessed against the selected family's existing radius/border contract; do not globally impose Shadcn geometry on Brutalist. No-JS theme selection needs truthful coverage labeling and, if light fallback is required, actual light fallback evidence. Existing input sequences, runtime inventory, test deadlines, ownership assertions and unsupported-profile requirements are not relaxed by this record. No Issue or PR acceptance checkbox was changed.
