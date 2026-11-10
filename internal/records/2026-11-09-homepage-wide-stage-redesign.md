# Homepage wide-stage redesign · 2026-11-09

## Request and scope

Human-assisted work from the maintainer's current request: reconsider the homepage against the current shadcn/ui homepage, use 2K-and-larger displays well, extend the composition with quiet skeletons at both edges, make the demos more expressive, and repair the visibly overflowing progress chart. Baseline is main `0607c6c5c386b8a932ab850e92a8873b2121dc45`. Historical homepage work is #776 / #777; this new composition does not reopen those items or take over #1191 (documentation navigation), #1378 (typography rollback), or compiler ownership.

Observed references: the maintainer's two supplied captures, and https://ui.shadcn.com/ read on 2026-11-09. The useful principles are a broad center of live examples, quieter peripheral continuation, and a mix of actual product tasks and data visualizations. No upstream source or brand assets were copied or executed. Existing bilingual hero lines, CTA text and destinations remain unchanged.

## Diagnosis and choices

- The old homepage parent capped the canvas at 88rem. A child-only width increase could not fix that. The homepage-only parent now permits 108rem; the live gallery caps at 104rem. Documentation reading widths remain unchanged.
- At wide desktop sizes, five explicit two-card groups communicate a deliberate composition. At narrower sizes, the same DOM order flows through the existing multicolumn model and finally one mobile column. Controls, typography and card surfaces retain their actual selected-family Prototypes.
- Quiet edge sketches are inert, aria-hidden SVG artwork, not simulated controls or a false loading state. They have a separate clipping/masking layer and no animation. They do not clip live popups, focus outlines or card content. They appear only where there is room beyond the live stage.
- The previous bottom fade covered real interactive cards. It is removed rather than making faded controls still receive focus. Attribution follows the entire live gallery.
- Ten examples are regrouped into controls/step finder, plan analytics/progress, preferences/help, editor/profile, and dialogs/notifications. Copy describes the task instead of inventorying component API names. A public passive Surface supplies the profile monogram's paint; the page supplies geometry only.
- The prominent completion number, remaining percentage and next-step label observe the existing public Progress value. Command, Slider and Reset retain their existing state ownership. Sample bars remain explicitly illustrative, not reported analytics. At zero progress they retain only the minimum visible bar height; at maximum they remain inside their SVG viewport.
- The chart overflow has a concrete composition cause: the Shadcn media wrapper was already outside CardContent, but a shared negative inline margin subtracted padding again and expanded it to `100% + 2.5rem`. The replacement is a 100% border-box media wrapper with a positive inset. SVG bars also have explicit in-viewBox containment checks.

## Criteria and evidence

- HP-01: 104rem live stage with five 2K+ columns and readable responsive ordering.
- HP-02: both decorative rails remain inert and separate from live focus/overflow.
- HP-03: richer tasks use real existing Prototypes and truthful page-local data.
- HP-04: media, chart and six bars stay within their own card, not merely within the viewport.
- HP-05: preserved bilingual hero, native links, task interactions and family/runtime switching.

Local focused verification initially exposed stale assertions for the intentional order, added Text owners and removed fade. Those assertions now check the new concrete design. The first real WC integration run reported eight unhandled static-hit-inset errors because its fixture omitted the generated stylesheet that the real website loads; no production host geometry was changed to hide them. Installing the existing shared generated-stylesheet fixture restored the real dependency and the rerun passed all 78 tests in six files with no unhandled errors. Three new geometry-observer tests include negative controls for wrong columns, reordered/split/overlapping cards, missing chart anatomy, and a bar outside its card but still inside the viewport.

The native browser suite adds a 2560px sample and card-relative chart containment. A real local Astro server returned HTTP 200, but Chromium failed before page creation with sandbox `socket() EPERM` and `ptrace` restrictions. Zero screenshots were generated. No source-bound native geometry, visual-quality, four-runtime browser or dark-theme acceptance is claimed. Do not use the maintainer's old images or an illustration as candidate evidence.

## Coordination and next steps

This checkout also contains separate Bootstrap and Select repairs by their owners. The Bootstrap dialog subsection of `homepage-gallery-parts.ts` is preserved. Commit grouping must retain both authors' scopes and exact changes rather than stage the entire dirty checkout as a homepage-only change.

Continue from the frozen candidate with full applicable type and homepage regression results, independent review, and an authorized real browser environment. Capture and inspect 2048/2560 desktop plus mobile, both themes/locales and relevant family/runtime interactions on the exact committed source; publish one SHA-bound progress/evidence comment per pushed development commit. Until then the redesign is an implemented, locally tested candidate with native visual evidence debt, not an accepted visual outcome or merged change.

## Freeze checkpoint

The independent static review found three concrete omissions and re-read their repairs: the browser's old three-scene expectation now includes analytics; chart/secondary text owners permit word wrapping at small widths and expanded text; and the real browser collector now passes its media/chart/bar rectangles to the same four-edge, positive-area validator exercised by negative controls. The backdrop also reserves 2rem of viewport clearance, and the next-step label now derives from the same public progress value, including the completed state. The reviewer found no further static blocker; this is not independent native visual acceptance.

The broader local homepage run was not green: 22 files / 248 tests produced 235 passes, 13 failures and 56 unhandled errors while an overlapping workspace type-check was killed by SIGKILL. A serial retry of the five failing files, with unchanged timeouts, produced 41 passes / two failures and 58 unhandled errors. The remaining assertions are in `homepage-typography-state.test.ts`, including the known #1378 failed-publication owner-identity regression and a runtime-publication timeout. The unhandled static-hit-inset errors originate in other real-prototype fixtures that omit the generated stylesheet (`homepage-typography-state` / `homepage-gallery.projection`); this run does not prove those fixtures or product behavior clean. Their owners retain the failures. No threshold was increased or assertion suppressed.

Final joint generated-style and workspace/docs checks are being run serially by the Bootstrap integration owner, to avoid the observed concurrent memory pressure. New real-browser evidence remains required on the committed combined candidate. Local logs distinguish the focused clean result, broad failure, serial retry and blocked browser startup; none substitutes for exact-commit CI.

## Hosted regression repair candidate · 2026-11-11

[Homepage workflow 42856256662](https://github.com/Proto-UI/Proto-UI/actions/runs/42856256662) executed the clean source at `4813343b4fb1dec99126970a3ef14c57a62da68b`. Its isolated composition job failed all eleven cases: one geometry-fixture assertion, seven mobile-overflow journeys, the Vue 2/Shadcn Select close journey, bilingual native typography, and CommandInput width acceptance. These are actual hosted failures, separate from the earlier local browser-startup restrictions above.

The candidate addresses the Homepage owners and observers as follows:

- The English whitepaper announcement paints beyond the 320px viewport while the gallery cards themselves fit. Its native anchor uses `home-runtime-link`; the former wrapping rule targeted an obsolete class. The Hero now constrains the announcement owner and lets the actual enhanced and fallback anchors wrap. Live controls and focus paint remain unclipped.
- A Select Item continues from outward `valueChange` delivery to its independent close request. This consumer now publishes the controlled acceptance through its existing owner-scoped queue after that event returns. The immediate Vue text-feedback path remains available for native caret restoration. The browser journey still requires End/Enter selection, popup closure, focus return, reopening, Home/Enter selection, and the same editor with its retained text. Native confirmation of this candidate remains required.
- The browser lane no longer duplicates the gallery observer's unit fixtures or pins an error to a card pair that changes when geometry is sorted. Those negative cases live with the existing geometry observer tests; the gap case moves a complete suffix so reading order remains intact and only the extra spacing is invalid.
- The native English and Chinese Hero recipes intentionally differ. The no-JavaScript journey now observes actual heading, tagline and announcement text boxes, viewport containment and clipping, and still follows the localized documentation link. It does not force both locales to use the English font weight and line height. The same passive Hero observations also accompany every enhanced layout sample, including 320px with doubled text.
- CommandInput acceptance measures the native input, its semantic Root and host within each authored parent, checks available-width growth across the existing 144/224/360px cases, edits at a native caret with real keyboard input and checks focus, and observes doubled text against each input's normal-size baseline. Native input overflow policy and a particular `flex-grow` token are diagnostic facts rather than acceptance criteria.

All product checks for this repair are **UNRUN** under the source-only assignment. Main owns serial focused and native before/after execution, independent review, and publication. The original bilingual copy, Rhea presentation, four runtime identities, six layout samples through 2560px, Bootstrap scope, draft specifications, contribution history, and protected historical evidence retain their existing conditions. The workflow's other nine failed jobs require their own attributed results; neither a passing composition slice nor source changes alone establish whole-workflow or broader #1164 acceptance.
