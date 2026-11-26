# Ordinary public Dialog native journey candidate

Issue: [#1161](https://github.com/Proto-UI/Proto-UI/issues/1161). This is the first bounded continuation of its Dialog acceptance child from main `0607c6c5c386b8a932ab850e92a8873b2121dc45`. AI-assisted implementation by Sol under the current user's human-assisted assignment. Product validation and publication belong to the integration owner.

The original [2026-11-07 audit](https://github.com/Proto-UI/Proto-UI/issues/1161#issuecomment-6700043691) selects modal close/focus and native motion evidence first. Existing source already contains the geometry-transition and controlled-dismissal repairs. This candidate does not assert a newly reproduced product defect or fabricate a failing before-run.

The shared `packages/web-conformance/test/shadcn-dialog.journey.test.ts` consumes the real recipe with synthetic DOM input. The ordinary Shadcn documentation browser suite previously exercised the WC partial-remount window only. The candidate extends that existing registered suite with eight native Chromium cases: WC, React, Vue and Vue 2, each under default and reduced-motion preferences. It keeps the old WC case intact.

Each case opens the unchanged public Rhea recipe through its Trigger, checks the live title/description relationships and browser accessibility tree, traverses Cancel, Save changes and CloseIcon in both Tab directions, and dismisses through keyboard Cancel, pointer Save, keyboard CloseIcon, Escape and an actual hit on the same projection owner's Mask. Every dismissal waits for natural view concealment, restored Trigger focus, original body overflow and closed accessibility-tree exclusion, then reopens the same owner. The driver never writes Root open, completes Transition controls or substitutes a simplified fixture.

`PROTO_UI_RUNTIME_EVIDENCE_DIR` enables per-state PNG captures and `dialog-public-native/observations.json`. The report records actual runtime/preference IDs, native DOM/focus/paint facts, browser AX observations, page errors and the result of each case. It hashes named direct source inputs and images; this is not a complete transitive source-closure admission. The caller must bind the whole execution source separately. Screenshots are local evidence until an authorized integration owner uploads and reads them back.

Authority remains draft: `P-BASE-DIALOG-CONTENT` owns presence, focus, dismissal and accessibility relations; `P-BASE-DIALOG-TRIGGER` and `P-BASE-DIALOG-CLOSE` own commands; `P-BASE-DIALOG-MASK` owns modal presence and pointer-default preservation; `C-AS-FOCUS-SCOPE-0002` owns loop and restore policy; `P-SHADCN-DIALOG-CONTENT` inherits those facts and the existing natural transition. The new implementation mapping in `T-BASE-DIALOG-CONTENT-0001` is **planned**, not passing. No product semantics, shared Focus implementation, Compiler/IR, central suite registry or historical calibrated geometry-probe source/hash is changed.

Implementation-time checks are **unrun** by assignment: no collection, browser/server, test, build, type, syntax, import, format or lint execution occurred. Main must run the existing registered browser file, preserve its original partial-remount case and all eight matrix outcomes, inspect the captures, validate the changed catalog and format/type surfaces, then obtain independent review. A failing assertion remains evidence to attribute and repair; shared Focus findings route to its existing owner.

The bounded candidate does not satisfy the whole Dialog row or close #1161. Browser AX is not assistive-technology or screen-reader certification. Controlled refusal, complete motion/first-frame review, responsive/zoom/theme/locale matrices, packed consumers and non-Web hosts retain their existing evidence obligations. The old matched geometry classifier and its uncalibrated/historical epochs remain unchanged.

All original Issue conditions remain open until earned evidence and lawful integration:

| Original family | Remaining condition and next action |
| --- | --- |
| Dialog (`issue.1161.001`) | Validate this public close/focus/AX candidate; continue controlled-owner, responsive/motion and AT evidence. Bootstrap/Liquid Glass mappings remain separately retained WIP. |
| Dropdown Menu (`issue.1161.002`) | Preserve single-level Group/Label/Separator/Shortcut behavior; continue full input/dismissal/AT evidence. Submenu and checkbox/radio require their own admission, as the current Base definition explicitly defers them. Fixed-source replay/docs remain with #1141. |
| Hover Card (`issue.1161.003`) | Continue trigger/link/focus boundaries, delays, interruption and native evidence for current Base/Shadcn/Brutalist behavior; retain Bootstrap/Liquid Glass mapping debt. |
| Image (`issue.1161.004`) | Continue each requested family mapping/recipe and actual source replacement, loading/error, fit, alternative-text/accessibility and native evidence. |
| Scroll Area (`issue.1161.005`) | Continue actual dual-axis, corner, visibility and minimum-thumb acceptance with #863; retain mapping and consumer obligations. |
| Separator (`issue.1161.006`) | Continue actual horizontal/vertical range, zoom and layout evidence with contentless/decorative semantics; retain Liquid Glass mapping debt. |
| Surface (`issue.1161.007`) | Continue full variants, spacing and visual evidence for the passive shell; explicit Liquid optics/native support remains its separate open scope. |
| Tooltip (`issue.1161.008`) | Continue applicable click/cursor policies, interruption, delay/skip-group, placement lifecycle and native accessibility evidence; retain Bootstrap/Liquid Glass mapping debt. |

The [0.3 plan](../governance/release-0.3-plan.md) admits acceptance and repairs for Base/Shadcn/Brutalist/Lucide while keeping Bootstrap and Liquid Glass in 0.4 WIP. No mixed original condition is deleted or counted as stable 0.3 completion. Historical registration, source-host and old native results remain attributed to their exact revisions.

The source keys and exact original wording remain in the frozen [release source ledger](../governance/release-0.3-source-ledger.json). Its historical whole-row `0.4` labels on `issue.1161.005`, `.006` and `.008` are retained as captured, alongside the current plan's committed-family boundary; this candidate neither rewrites the frozen ledger nor treats those old row labels as permission to skip committed Base acceptance.
