# Sprint 3 public audit primary subjects

## Retained native source and exact subjects

Source `830287f95959a4a1a4fb797df68b0bd6889e0bae` retains eight failures each for Live Region, Async Region, Input and Image. Every case stopped at `Interactive anatomy has no current primary target.` before a PNG was captured. Their original planned states remain `rest`, `hover` and `keyboard-focus`.

The Live/Async cases are in the naming archive (SHA-256 `ad42148dd07a4e97f0abd25d3ceb9e338fa848f2925ba8011f1ffbb920df140c`); Input/Image are in the passive archive (SHA-256 `95303ded4c27553932e093e7f79615d454ebcb6ddc572c5246ad41a3d70e0f84`). The new observer admits these three actual public subjects:

| Family | Authored subject | Scope of the retained three states |
| --- | --- | --- |
| Live Region | `announcePolite`, a real `brutalist-button` from `createLiveRegionDemo` | That public action's visual rest/hover/focus. It does not establish a region announcement or physical assistive-technology result. |
| Async Region | `markBusy`, a real `brutalist-button` from `createAsyncRegionDemo` | That public action's visual rest/hover/focus. It does not establish busy-state transitions or announcement behavior. |
| Input | The unique native editable input named `Name`, initial value `Guang` | That actual editor's rest/hover/focus. Disabled and read-only examples cannot substitute. Typing, composition and controlled-refusal conditions remain separate. |

Button selectors require the authored ref, exact prototype and role inside the selected Previewer. Input selectors require the actual named native editor, preserving strict uniqueness. Input also reuses the existing Textarea physical-editor identity rules for its fingerprint, paint and focus observations, including a WC wrapper's current native part. Missing, duplicate, foreign-owner or stale-generation editors are rejected; the same native nodes are not inferred from an outer wrapper. No Core or Adapter implementation changes.

## Image remains unresolved

The first diagnosis incorrectly applied `image-demo.shared.ts` to the Brutalist route. The actual `zh-cn/demo-brutalist-image.demo.ts` is an independent static recipe: `fit-contain`, `fit-cover`, `fit-fill`, `decorative` and `error`. Its manifest contains only `brutalist-image-root`; it has no `loadImage` button or other interactive primary. The first candidate's eight failed Image controls exposed that mistaken source assumption.

No Image action is invented and no Image is made focusable. The new source/scope control verifies the actual recipe and manifest, absence of a primary, retention of all three original planned states and the unresolved classification. The original eight native failures remain unresolved until a legitimate consumer/acceptance decision is implemented and actually verified. They are not moved into the existing Scroll Area known-unsupported domain.

## Independent Tooltip inventory reconciliation

The existing inventory assertion still expected three Tooltip hosts and a total of 222 runtime/theme cases. Actual source declares WC, React, Vue and Vue 2, giving 224 cases for the 28 admitted families. The assertion now matches that exact public declaration. The source parser is unchanged and still rejects invalid declarations.

This is separate from the stale three-host list in `contrast-tooltip-handoff.mjs`, which rejected the original 20 native warm-handoff cases before business assertions. That planner repair and its evidence have their own record. The prior 26 passive-boundary selection did not execute this inventory check.

## Preserved local development outcomes

| Run | Actual result | Interpretation |
| --- | --- | --- |
| Old source, preliminary 32 subject controls plus existing inventory | 0 passed, 33 failed; exit 1 | Missing primary branches and actual 224-versus-222 inventory mismatch. The eight proposed Image controls contained the mistaken source assumption described above. |
| First candidate, same preliminary selection | 21 passed, 12 failed; exit 1 | Eight Image failures invalidated that assumption; four Input fixture reads ran before the required subject binding. |
| Corrected 24 real subject controls, inventory and Image scope control | 22 passed, 4 failed; exit 1 | Four controlled Input fingerprint fixtures lacked `visualViewport`; this was supplied as `null`, following the file's existing synthetic fingerprint fixtures. |
| Whole corrected selection after that fixture input | SIGKILL during module loading; process exit 1, no JSON terminal | No case result is inferred from the process failure. The cause is unknown. |
| Node instrument guards, including 13 additional Input identity controls | 227 passed, 0 failed; exit 0 | Existing Textarea behavior plus native/light/shadow Input identity, missing/duplicate/foreign/stale and physical-replacement controls. Controlled DOM/CSSOM evidence only. |
| Four serial host processes, same final source and assertions | WC 8/8, React 6/6, Vue 6/6, Vue 2 6/6; every process and aggregate exit 0 | 24 actual-producer controls, the existing inventory check and one Image source/scope control; 26 selected checks, not the whole file. |

The actual Input test now follows the existing native entry order: bind and validate the selected subject before its fingerprint. It does not add a production fallback. Original negative controls and native thresholds are unchanged.

The final source was checked in separate serial host processes with unchanged test assertions and a 60-second process resource deadline. All four completed normally in under ten seconds each. The accompanying JSON preserves each command, exit, selected counts and raw log/report digests, together with the four unchanged source-file hashes. The earlier whole-selection SIGKILL remains a separate unknown execution outcome.

Native reruns for the three repaired families × four hosts × two themes remain required. Their 24 original native failures are not replaced by these 24 actual-framework observer controls. Image's additional eight original failures also remain. None of these local checks accepts the complete website journey, image-resource semantics, physical assistive technology or visual conformance.
