# Material selection surface and failed remount follow-up

Baseline: #809 `fb877ad74a55c04f1153d8c713c2b7435bfde798`. This follows the three ancestor/lifecycle repairs without relabeling their evidence. Review threads 4188047284 and 4188163719 remained open and were inspected against current source rather than inferred fixed from thread age or another branch.

## Governing boundary and reproduction

`C-FEEDBACK-STYLE-0004` explicitly permits the single static `selection:<style-token>` surface. The old material sink classified `selection:bg-primary` as host fill and removed it; a selection text token was retained but incorrectly forced unresolved-style-provenance fallback. Two negative controls reproduced both failures. The fix excludes only the valid single-prefix selection surface from host paint/provenance predicates. The rendered fixture uses the already documented `selection:bg-primary selection:text-primary-foreground` pair; `selection:text-white` is not supported by the current CSS compiler and is not claimed.

The current base owner and #832's newer cleanup owner both left attachView synchronous failure unguarded. Two direct owner controls reproduced retained hasView/capabilities after a failed mount, including a throwing disposer. A real WC/Feedback consumer then reproduced an unreleased failed sink before the next intent change. The first attempted test incorrectly called a lifecycle method outside a Runtime callback; that harness error was corrected to use the existing exposed-method callback scope before accepting the negative result.

## Minimal repair

Existing-wiring attach rollback identifies the failed lease by an attachment generation, ends the failed epoch, releases its view, then restores owner capabilities if cleanup did not install a replacement. Original errors survive secondary cleanup failures. Ending the epoch matters: a first-frame failure can leave Runtime mounting, and restoring capabilities without ending it lets a replacement sink replay and be retired under the failed epoch. The actual WC retry assertion exposed this during development. Two additional controls ensure replacement views installed during unmount/disposer cleanup are not cleared. Independent review found that comparing only disposer function identity incorrectly clears a replacement when a synchronous mount callback reuses the same function; a further negative control reproduced that result, and both rollback guards now compare the captured generation.

This changes the attach branch and adds its generation counter on the standalone #809 branch. #832 already has viewVersion; normal union integration must reuse that counter rather than declare another one. Its exception-safe detach/dispose changes are not overwritten or copied. Normal history-preserving integration must retain both changes; a union requires fresh verification.

## Verification and outstanding work

- Old-source negative cases: two selection classifier failures, two owner rollback failures, and real WC failed-sink non-release.
- Focused base owner/material controls pass; broad base/WC/Runtime/Feedback validation passed 758 tests across 163 files, with 34 existing todos across three skipped files. Final source-bound counts and independent review are recorded in the commit evidence comment.
- Independent review applied the generation-correct attach patch to the newer Focus/material owner, preserving its shared counter and all detach/dispose protections. The reviewer reran nine rollback/identity controls and 35 existing owner/material controls without an actionable finding. Its bounded direct union measurement passed all nine caps (React 90,992/91,000 and Vue 90,764/90,800); this is not the later full integrated feature head or its canonical CI. No code golfing or cap change was used.
- Source fixture produces actual `::selection` background/foreground CSS from the documented pair. New browser assertions inspect both computed colors, retain enhanced output and capture a real selection. Browser execution remains exact-head CI work because the previously verified local socket restriction is not bypassed.
- Existing nine caps remain unchanged; local Runtime 67,808/69,200; React 88,479/91,000; Vue 88,213/90,800; WC 96,708/104,500. These standalone measurements do not stand in for the Focus/material union.
- No arbitrary style variant, selection API, lifecycle promotion, independent approval, or main integration is claimed. #824's independent numerical acceptance remains a dependency; the budget-review thread is not closed as accepted by this repair.
