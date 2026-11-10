# Brutalist contrast review separation — 2026-11-10

Non-normative implementation/evidence record for [Issue #469](https://github.com/Proto-UI/Proto-UI/issues/469). Source candidate only: the new helper and its calibrations have not been executed. This record neither changes a Prototype nor supplies contrast certification, independent acceptance, public screenshots or Issue closure.

## Source and ownership

The candidate starts at `0607c6c5c386b8a932ab850e92a8873b2121dc45` in the assigned Issue #469 worktree. The live Issue is OPEN, assigned to `cyjin-yl`, with 11 comments delivered by the paginated API, matching its independently reported comment count. The final discussion is the non-closing [PR #887 source carry](https://github.com/Proto-UI/Proto-UI/issues/469#issuecomment-6164286522). The original body and all eight `issue.469.001`–`issue.469.008` source keys in `internal/governance/release-0.3-source-ledger.json` remain unchanged.

Current authenticated readback identifies `cyjin-yl` (19223209), repository MAINTAIN with `admin: false`. This owner is authorized to prepare three new files only: the offline review helper, its focused calibrations and this record. Main owns all product checks, independent review, shared-driver integration, source publication and lawful closure. Issue #1164 retains the current consumer census. Other owners retain family semantics and dedicated native journeys. There is no source, style, palette, P/T, generated CSS, driver, probe, workflow or registry change in this slice.

## What the projection changes

`apps/www/scripts/contrast-review-separation.mjs` reads an existing schema 2 or schema 3 audit report and its referenced artifacts. For schema 3 it verifies the compact frame's journal digest and identity, then verifies the referenced PNG and facts digests. It does not launch a browser, decode/recompute paint, rerun native input or modify retained artifacts. The CLI emits JSON to standard output.

The output preserves the audit's metadata, cases, errors, unresolved targets, source identity, evidence debts and frame status. Each text run, native-value text measurement, placeholder, glyph paint, inner/outer border/fill adjacency and shadow receiving metric gets an address tied to its original frame and surface. Null ratios, unsupported/exempt source classifications, limits, inactive state and the original unclassified cue disposition remain visible. The `belowFloor` list retains every recorded ratio below its comparison floor, including rows later annotated as redundant or decorative. Row count is not a count of unique assertions: host text and individual text-run measurements may overlap.

Four outputs stay separate:

| Output | What it means | What it cannot establish |
| --- | --- | --- |
| `text` | Original ratio and a 4.5:1 normal-text comparison, or 3:1 when recorded size/weight qualifies as large text | Unrestricted rendered-pixel or shipped-family conformance |
| `nonText` | Original component/state, border, glyph and shadow numbers compared to 3:1 | Whether the cue is required, redundant or decorative |
| `grammar` | Supplied source-role annotations compared to the explicit #427 fill/frame pairs | Authorization to replace current P criteria, geometry or shadows |
| `perceptual` | Supplied component-specific glare/loudness observations and references | A numeric WCAG failure or permission for a palette redesign |

No cue receives required/redundant/decorative status automatically. Optional annotations must bind the exact original report SHA-256 and an existing metric/surface address, include rationale and evidence references, and remain labeled as supplied annotations. The helper cannot authenticate a reviewer or independent approval. A ratio meeting a numeric floor is named `at-or-above-floor`, never a conformance pass. A source-model inset ratio remains source-model-only even when an annotation says its cue is required.

## Historical findings retained with their actual scope

These are the recorded values from the August source audit and subsequent Issue discussion, not new measurements of the November palette:

| Historical observation | Recorded ratio | Disposition retained |
| --- | --- | --- |
| Dark Textarea note strip | approximately 5.77:1 | Normal-text AA numeric pass; perceived loudness is separate |
| Unused `secondary-foreground` pair | 1.39:1 | Historical dead-token finding, not a shipped user-facing failure |
| Light Dropdown/Select focused default fill | approximately 1.16:1; v1 recorded 1.164:1 | Below 3:1; cue necessity and state correspondence require corrected review |
| Light destructive menu focus fill | approximately 1.41:1; v1 recorded 1.411:1 | Below 3:1; retain the number and the review boundary |
| Black frame against Dark page/panel | 1.17:1 / 1.39:1 | Low edges; no automatic component-wide failure |
| Historical unselected hovered Tabs Trigger | inner 1.17:1, outer 1.39:1, fill separation 1.18:1 | Both adjacencies and the historical state remain relevant to that source; not a current recipe assertion |
| Dark foreground on fixed canary/sky/coral/lavender | 1.07 / 1.22 / 1.29 / 1.27:1 | Historical inner-edge observations; actual exterior/alternative cues are conditional |
| Black hard shadow against Dark page/panel | same low pair values | Per-call-site and per-state classification remains required |

The [2026-08-26 record](2026-08-26-brutalist-wcag-contrast-evidence.md) is a source audit. Its old call-site classifications and its old theme values cannot become current native acceptance. The [September integrity correction](https://github.com/Proto-UI/Proto-UI/issues/469#issuecomment-5904086211) withdraws the 372-frame completeness, zero-gap, sole-focus-cue and blanket Dark-pass conclusions. The [corrected October carrier](https://github.com/Proto-UI/Proto-UI/issues/469#issuecomment-5939127866) remains partial. Historical failed/partial runs, unavailable uploads and the recorded Select 1:1 neighbor observation are not cleared by this candidate.

## Frame authority and permitted repair boundaries

[#427's landed decision](https://github.com/Proto-UI/Proto-UI/issues/427#issuecomment-5376913069) pairs a frame with the fill it encloses: fixed accents take their corresponding `*-foreground`; background and secondary-background take foreground; card/popover take their own foreground; foreground as fill takes background. Unknown fills need a declared pair. There is no universal structural-ink, raw-color sweep or blanket border-foreground repair.

Current authority also includes draft `K-BRUTALIST-0001`, source-pinned Neo-Brutalist visual alignment, draft `D-BRUTALIST-DEPTH-MOTION-GRAMMAR-0001` with category-specific depth/motion, and current component-specific P entities. At the assigned base, `P-BRUTALIST-TABS-TRIGGER-INTERACTION` explicitly describes a rounded flat control with black frames and no Button movement. `P-BRUTALIST-SELECT-ITEM-VISUAL-GRAMMAR` supplies an interaction border independently of selection's check mark. `style.ts` still includes universal black in shared structure/panel recipes. Current theme colors and radii differ from the historical audit.

That is a read-only authority conflict to reconcile before a migration, not permission to restore old square geometry, remove current frames or change motion to match an old screenshot. The helper reports the #427 pair comparison separately from current conformance. Theme-relative surfaces and inverse foreground fills are candidate semantic-pair repairs only after their final state rule, current owning P criteria and actual adjacencies are reviewed together. Fixed-accent controls must keep their declared accent pair. A focus repair requires demonstrated current missing focus information, rather than copying the old fill-only finding onto a recipe that now has a frame. A shadow change requires its own role/necessity review and depth decision. Canary glare and coral loudness require component-specific visual proposals with both-theme state/text evidence; no palette change is made here.

## Original-condition accounting

Every condition below remains open at Issue level. The candidate supplies a bounded separation tool, not the original full-family evidence or migration.

| Original source key | Original condition | Candidate contribution and remaining work |
| --- | --- | --- |
| `issue.469.001` | Every shipped text-bearing pair is tested on its actual composited background in Light and Dark; all normal text is ≥4.5:1 or has an explicit WCAG exception. | Preserves text ratios, recorded font evidence and source limits. Main still needs complete current shipped-family/native text coverage, actual compositing and reviewed exceptions. |
| `issue.469.002` | Every required component/state indicator is identified first, then tested at ≥3:1 against the actual adjacent color(s). | Keeps all numeric edges and default unclassified status. Independent necessity review and all required adjacent surfaces/states remain outstanding. |
| `issue.469.003` | Decorative shadows and perceptual-only findings are not mislabeled as WCAG failures. | Adds separate supplied-review/perceptual tables without deleting below-floor rows. Main must run the calibrations and exercise actual annotated consumer evidence; call-site shadow review remains incomplete. |
| `issue.469.004` | The #427 surface-paired frame grammar is implemented across all structural consumers and state/variant paths. | Adds explicit pair comparison for supplied source roles. Shared source migration and reconciliation with current P authority are not performed. |
| `issue.469.005` | No universal `structural-ink` token, raw-color sweep, or blanket `border-foreground` replacement is introduced. | No product/style/token changes. Main must preserve this boundary during any later migration. |
| `issue.469.006` | WC, React, and Vue produce equivalent computed evidence in both themes. | Keeps runtime/theme/frame identities. No equality or complete matrix result is claimed; Vue2 evidence stays additional and page-specific. |
| `issue.469.007` | Spec P/T entities, generated style closure, focused tests, and browser evidence agree with the rendered behavior. | New offline calibrations are authored and unrun. P/T/generated/native reconciliation remains Main's work after the authority decision. |
| `issue.469.008` | Square geometry, 2px frame width, hard-shadow geometry, interaction motion, focus, and component semantics remain unchanged unless a separately approved slice says otherwise. | No product change. Existing source-aligned geometry/category changes remain historical facts requiring their own provenance; this slice does not revert or approve them. |

All four delivery slices remain tracked: the complete rendered harness matrix; all-consumer frame migration; every shadow call-site/state classification; and separate component-specific Dark perceptual review. Dialog's composited overlay perimeter, arbitrary authored parent fills, ScrollArea's unsupported rounded profile and unexecuted targets, dedicated journeys #852/#860, public assets and AT limits remain distinct debts. PR #887's carrier and original eight criteria are not rewritten or checked off.

## Serial Main validation and actual consumer procedure

Run these only in Main's serial validation slot using Node 24. The commands below are proposed and have not been executed by this owner.

1. Retain the baseline report and compare its SHA before using it:

   ```sh
   sha256sum /tmp/c775native1-1110/contrast-evidence/candidate/report-final.json
   ```

   Expected historical input identity: `0cc067c4194e0496de5da580ae347af1f3c9dade9ef751d394a53ab1cc2384f3`, source `5ed3cbeaad83533c97bb86a36e74dbb54b3c3d26`. Parent's existing readback records 48 frames/8 runtime-theme cells for Textarea only. This is a real retained input, not a new candidate run or full-family result. Preserve it verbatim, including null exterior metrics and unsupported placeholder paint. An input mismatch requires reconciliation, not replacement of that historical digest.

2. Execute the focused reader and classification falsifiers:

   ```sh
   node --test --test-concurrency=1 apps/www/scripts/contrast-review-separation.test.mjs
   ```

   Ten authored cases cover separated numeric domains; decorative/redundant review without numerical erasure; actual size/weight large-text boundaries and unrounded failure; unsupported/inactive/unstarted status; stale review SHA rejection; image/facts/journal tampering; frame-state receipt mismatch; unknown/duplicate/text-as-indicator review rejection; historical schema 2/inverse/unknown pairs; and read-only CLI consumption. Fixtures are explicitly injected calibration data, not native screenshots or product reproductions.

3. Exercise the actual retained consumer input, capturing stdout as a new evidence artifact outside the input directory:

   ```sh
   node apps/www/scripts/contrast-review-separation.mjs \
     /tmp/c775native1-1110/contrast-evidence/candidate/report-final.json
   ```

   Compare each emitted `ratio` against the referenced original facts field and require unchanged frame count/status, input SHA, cases, evidence debt and null/unsupported limits. All non-text rows must remain unclassified in this invocation; grammar/perceptual arrays must be empty. Current retained source hashes remain labeled `5ed3...`, never relabeled as this candidate. Independently count original numeric fields and compare to emitted row identities rather than relying on a helper-generated summary.

4. Review actual frames before supplying classifications. Run the same CLI with a separate exact-report-bound review JSON:

   ```sh
   node apps/www/scripts/contrast-review-separation.mjs \
     /tmp/c775native1-1110/contrast-evidence/candidate/report-final.json \
     /tmp/release03-issue469-reviewed-cues-20261110.json
   ```

   Main creates that last file only after actual scoped review. An unannotated run above already supplies meaningful normal consumer use. A deliberate changed-report digest, changed PNG/facts byte or nonexistent metric is a failing input control; a decorative annotation on a low shadow must leave the ratio and `belowFloor` membership unchanged. These controls concern the projection, not injected product defects.

The native consumer represented by that retained input is the public English Brutalist Textarea page, `/en/ui-libraries/brutalist/components/textarea/`, with its own runtime/theme controls. Its six recorded states are rest, hover, keyboard-focus, empty-placeholder, disabled-and-readonly and live-props-restored, across WC/React/Vue/Vue2 and both themes. For visual review, inspect actual full images and state pairs, including focused border/ring versus actual surrounding pixels, placeholder/native text, dimmed inactive state and restoration. Source-model-only/unmeasured rounded exterior metrics must remain unresolved. Do not use a contact sheet or a green reader test to certify the full family.

This offline-only diff does not warrant a duplicate native run merely to regenerate those old facts. The original Issue's full-family acceptance still requires Main's exact-current-source harness and dedicated journey/paint owners, with separate before/after captures if a later product repair is admitted. Any new product source uses the Main-owned driver, exact new provenance and a new create-only output directory; old reports and hashes remain literal history.

## Annotation format

An unannotated CLI invocation needs no review file. An actual review file has this shape; each nonempty entry must refer to an existing frame/surface/metric address and real review evidence:

```json
{
  "schemaVersion": 1,
  "reportDigest": "sha256:0cc067c4194e0496de5da580ae347af1f3c9dade9ef751d394a53ab1cc2384f3",
  "parentSourceKeys": ["issue.469.001", "issue.469.002", "issue.469.003", "issue.469.004", "issue.469.005", "issue.469.006", "issue.469.007", "issue.469.008"],
  "cues": [],
  "grammar": [],
  "perceptual": []
}
```

Cue entries contain `id`, `classification`, `rationale`, and nonempty `evidence` references. Grammar entries contain `surface`, `fillRole`, `frameRole`, `source`, `rationale`, and `evidence`. Perceptual entries contain `surface`, `observation`, `rationale`, and `evidence`. Empty arrays represent no review, not passing review. Source-role annotations never infer token authorship from identical computed colors. Main's independent review and metadata admission remain separate from this format.

## PR preparation and remaining acceptance

Proposed title: `audit(brutalist): separate contrast observations from visual review`

Proposed body: “Project retained native contrast facts into separate text/non-text numeric, supplied cue-review, surface-pair grammar and perceptual outputs. Preserve below-floor values, unsupported/unclassified states and all original Issue #469 criteria without changing palette, frames or the shared driver. Validation is pending Main's ten focused calibrations and the retained Textarea consumer readback; full-family necessity review, frame migration, current native evidence, public visuals and lawful Issue closure remain open.”

Use `Refs #469`, not a closing keyword. Metadata-valid handoff is routing evidence only. No test, syntax/import check, formatter, build, install, browser/server, Git mutation, PR write or Issue edit was performed during implementation.
