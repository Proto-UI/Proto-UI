# Select overlay mount clearance

## Scope and retained native failure

Product source change is limited to ordinary CSS spacing on the four existing, explicitly owned Liquid Select stage overlay boxes. A separate read-only test observation change retains additional native diagnostic fields. This candidate starts from `81722b5fd969e9a86e5b07d35f21486df1ab220a` and has not run in a native browser. It does not change source admission, material profiles, optical thresholds, public Select semantics or the original test assertions and budgets.

[Select native run 44963404765](https://github.com/Proto-UI/Proto-UI/actions/runs/44963404765), attempt 1, executed that exact base and tree `25916f297a3ea49b501dec569527cdf69cf04fc2`. Its one file completed all 24 original cases in 312.90 seconds: **16 passed, 8 failed, no skips**. No outer resource truncation occurred. All eight Liquid selection cases failed at the unchanged Trigger `self-optical` poll, test line 328, after 20,000 ms. The preceding Surface optical assertion passed. Bootstrap selection and both families' native Text selection passed. Liquid selection, controlled behavior and 320px/200% RTL checks after that first failure remained unreached.

The actual artifact is `14730149866`, 2,943,873 bytes, SHA256 `ff11a737802c73ebf8c1e36e25d8cd48ba36b45f399a0db96861e9da197b8bb5`. All 49 entries and 32 PNGs were verified in the retained native archive. React/light and WC/dark failure images were directly inspected; neither image is presented as evidence of this later source change.

## Observed transition and layout decision

In every runtime and theme, the base's before-open Trigger now reports `self-optical / rendered`. After opening, it reports `opaque-fallback / source-overlapping-content`, while the popup Surface remains `self-optical / rendered`. These observations preserve the closed-state improvement from the preceding spacing repair without calling the complete flow successful.

The eight relevant native rectangles are identical:

| Part                       | Observed borderbox                                         |
| -------------------------- | ---------------------------------------------------------- |
| Trigger                    | x480, y508.5, 93.8125 × 38; bottom546.5                    |
| Popup Content and Surface  | x480, y562.5, 192 × 379                                    |
| `uncontrolledStageOverlay` | x480, y546.5, 432 × 0                                      |
| Source stage               | x448, y440.5, width496; height138 before open and 565 open |

The existing scene creates a `height:0` overlay mount after its Flow part. Its `:empty` CSS has opacity0; after portal children arrive, observed opacity becomes1. The unchanged source predicate considers the mount's line at the Trigger bottom to intersect the Trigger's complete 9px contact footprint. The original public probe did not identify the private first rejected candidate or collect every paint field, so this remains a source-supported explanation of the observed fallback rather than a recorded private trace.

The layout change adds `className: 'mt-4'` to the existing Overlay box in the shared `materialStage` helper. All four declared scenes receive the same ordinary layout rule. It preserves the existing heading spacing and `sideOffset:16`; it does not hide the mount, exempt any ref or marker, skip descendants, or introduce a reservation API. Base Select's placement remains `strategy:'fixed'` with its existing positioning owner. The margin is not a second authored popup side offset.

For the recorded host dimensions, an actual 16px mount gap would leave 7px beyond the unchanged 9px footprint. This is a prediction to verify. `mt-4` uses CSS spacing, so the actual computed margin and geometry must be observed again, including at 200% text. Adding a margin can increase a stage's flow height and move later stages; no claim is made that every coordinate remains unchanged. Trigger borderbox/hitbox styling and Flow content are not edited.

## Why the generic source change was rejected

The initial exploration considered a positive-area intersection test plus strict checks for ordinary empty containers. That is insufficient to prove absence of foreign paint: a standard DIV may own a closed ShadowRoot while `shadowRoot` is null, the light DOM is empty and its borderbox has zero area. A tag/CSS check cannot reliably distinguish that case from a plain empty box. Borders, shadows, authored pseudo paint, direct text, overflowing descendants and private carrier footprints also must not be inferred away.

The integration owner therefore selected a real layout correction. `packages/adapters/base/src/material/source.ts`, `contact-carrier.ts` and the existing source tests remain byte-identical to the base. The exploratory new controls were drafted, retained as an unexecuted scratch patch and removed from the product tree. **They were never run; no red-to-green source-guard result is claimed.** The draft safety direction in `C-MATERIAL-PAINT-FOOTPRINT-0001-SAFETY` is preserved, and no definition is promoted or new public footprint capability asserted.

## Diagnostic observations and validation

The existing Select snapshot now includes namespace and constructor, direct text counts, public owner relationships, computed margins, ordinary paint and `::before`/`::after` paint geometry/styles. URL-valued CSS is recorded as a category instead of copying image data URLs. A null `shadowRoot` is explicitly recorded as `none-or-closed-unobservable`; a public carrier marker does not claim private ownership. Successful flow JSON now retains the already collected `materialEvidence`, so future success does not discard the before/open observations. The snapshot remains read-only and separately timed; it is not a claim that all observations and screenshots share one renderer frame.

Normal `corepack pnpm@10.32.1 install --offline --frozen-lockfile` succeeded using Node 24.22.3 and pnpm 10.32.1. No manual dependency symlink or local browser workaround was used. The two existing Select layout and material-stage fixture suites passed **18/18 cases**, with one worker, in 1.41 seconds. They cover the existing source/compiled-CSS recipe, declared stages and lifetime controls; they do not prove native placement or optical paint. No mirror assertion for the new class string was added.

AST comparison preserves all 130 expect-rooted call-expression nodes in order, both test-name templates, the original 120s and 90s case budgets, and the 150s setup budget. After removing only the read-only snapshot function and new successful-JSON property, the remaining test AST is unchanged. This retains the full original 24-case selection and all actions and assertions. Prettier and `git diff --check` pass. Exact integrated types, source projections, budgets, and new-head native Select/Material/full-cycle evidence belong to the integration owner and remain unclaimed here.

The next native run must establish all 24 original outcomes, actual Overlay margin/position, Flow/Trigger/Surface geometry and public before/open paint. It must retain any remaining failure and the original RTL optical-claim boundary. The complete source digests, old native identity, actual 18 fixture results, assertion-preservation receipt and unexecuted exploration boundary are in [2026-11-22-select-overlay-mount-clearance.json](./2026-11-22-select-overlay-mount-clearance.json).
