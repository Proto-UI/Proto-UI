# Independent review: relevant-scroll positioning repair

## Scope and conclusion

Base: **`92d3331636ff6337c87fc557f4b0334d426398dd`**. I reviewed the frozen, uncommitted owner-authored changes in `floating-ui-host.ts` and its test file, plus the root-authored four-path source-recorder addition in the focused workflow. The exact file hashes below bind this review; no candidate commit SHA is invented.

**No unresolved substantive source defect was identified in this bounded repair.** This is a local technical review under the repository `pui-dev` → `pui-review` route, human-assisted/current-user. It is not a platform approval or a native acceptance result. The previous exact92d public Contents failure remains the last observed product result at this cutoff.

The governing draft contract `C-ANCHORED-POSITIONING-0001` and host capability `HC-ANCHORED-POSITION-0001` assign overflow-ancestor discovery and bounded observation to the host. This change stays within that host lease and does not change portable component declarations, lifecycle status, release support, focus, or the public test assertion.

## Owning-layer behavior

The prior capture fallback called the positioning solve for every document scroll. A solve temporarily releases the previous available-size projection before intrinsic measurement. The initial new regression controls show that even a floating panel's own scroll synchronously removed its available-height cap under the old host, before a later solve could restore it. This is a directly exercised source-level problem, distinct from the still-unproven native transient-reset explanation.

The repair routes captured scroll only when its actual origin is the document or a strict composed ancestor of the current reference or floating box. A panel's own scroll, a descendant unrelated to its reference, an unrelated sibling, and the reference's own scroll do not enter this fallback. The check is per positioning lease; it does not suppress all scrolling inside floating content.

That distinction preserves nested behavior: an outer floating panel can keep its own cap while its scrolling moves an inner popup's reference. A scroller inside a floating box is still relevant if it actually contains that lease's reference. A scrolling ancestor of the floating box remains relevant even when the reference is elsewhere.

Composed traversal follows assigned slots, parent nodes and shadow hosts. The helper observes the relevant documents and encountered ShadowRoots, so a real non-composed element scroll within an observed open shadow root can reach the fallback. It refreshes the root set before a current solve, removes obsolete roots, and revokes all added listeners on lease cleanup. Its disposed guard prevents refresh from reviving observation. The same-target update control verifies migration to a second shadow root and retirement of the first root.

For events visible at several observed roots, only the outermost observed root in that propagation handles the event. The final implementation retains no cross-dispatch Event identity. This corrects the intermediate WeakSet candidate, which discarded a later legal dispatch of the same Event object. Actual origin selection uses `composedPath()[0]`, rather than treating a retargeted open-shadow host as the scroller.

## Preserved boundaries

The intrinsic measurement/collision machinery, style-lease implementation, root-space observer, ResizeObserver and size-match behavior, and explicit update/requestUpdate path remain unchanged. The separate `targetAlignment && !sizeMatch` branch still uses `createTargetAlignmentLease`; this patch does not filter that branch's scroll policy.

The original public matrix, native oracle controls and wheel diagnostic observer are byte-identical to exact92d. The real wheel input, current-owner checks, final cancellation sampling and **1000 ms** movement assertion are preserved. The repair introduces no scrollTop restoration, forced wheel success, CSS override, timeout extension, or browser security change.

The workflow change only adds four exact source paths to its existing before/after hash recorder: the changed host, its test, `owned-style-lease.ts`, and `root-space-observer.ts`. The record expands from 10 to 14 source-file entries; the five generated-output requirements and execution/selection behavior are unchanged.

## Checks and evidence limits

I read the author's retained logs and independently ran only `git diff --check` and source/hash comparisons. I did not rerun tests or launch a native browser.

| Check/version | Actual retained observation | Meaning |
| --- | --- | --- |
| Old92d host with initial 11 new controls | 8 failed, 3 passed; 9 original tests skipped | The initial host regression controls distinguish the old implementation. This is not a run of every final added test. |
| Intermediate WeakSet candidate, Event reuse control | 1 failed, 22 skipped; 104 px retained where 84 px was expected | Identifies a defect in that superseded candidate. The final source uses per-propagation path routing. |
| Final positioning and four-adapter selection | 25 files, 328 tests passed | Source-level geometry, nested/root/shadow/slot, lifecycle and existing adapter regression evidence. |
| Workspace TypeScript, default heap | Node heap exhaustion; author reports exit134 | A failed resource-bounded attempt, not a passing typecheck. |
| Workspace TypeScript, 4 GiB heap | Two TS2307 diagnostics for the absent generated shadow module | Still not a passing workspace check at this cutoff; no host-source diagnostic appeared in that output. |

The missing generated module is referenced by `scripts/analysis/fixtures/shadow-s3/admission.ts:5` and `shadow-s4/dialog.ts:14`. A later fresh generation/typecheck result must be recorded separately; it is not inferred from this review. The original OOM and missing-input logs are preserved.

The shadow/slot controls use real open ShadowRoots with non-composed synthetic scroll events; Happy DOM's missing assignedSlot link is explicitly modeled. This establishes host routing under that model, not native closed-root or all-browser coverage. Existing source-level intrinsic/content-flip controls remain in the passing selection.

The patch prevents unnecessary captured-scroll solves. Legitimate geometry updates still perform the existing intrinsic remeasurement, so this review does not promise universal scroll-offset preservation across every genuine resize, reparent, or ancestor-position change.

## Native acceptance remains outstanding

Exact92d recorded an unchanged valid Content and two UA-dispatched scroll events whose callbacks already read zero. It did not capture a positive offset or directly identify a resetting operation. The source mechanism and red/green controls justify this targeted candidate, but the original native public matrix must now be rerun on the new published source. That result must be paired with its source hashes and actual generated CSS/shadow outputs. Until then, there is no native repair-success claim.

## Frozen source hashes

| File | SHA256 |
| --- | --- |
| `packages/modules/positioning/src/web/floating-ui-host.ts` | `f9fc1f2cb64e08ce452b693ae054f439430e3abb6f98d31013c59ea5d44b9715` |
| `packages/modules/positioning/test/floating-ui-host.test.ts` | `46cbe728958f3f4e03c8b007221b0d65037d3814d57cc3bd61087a02e435d3e4` |
| `.github/workflows/browser-suite-repair-evidence.yml` | `e801829655de84593104b60fd5e0f51a5342973472b9401594927fe5d8f3f443` |

The companion JSON also records unchanged source hashes and retained log hashes.
