# Independent read-only investigation: retained Contents wheel failure

## Scope and observed outcome

Reviewed run `45383599762`'s hosted `shadcn / wc / click` receipt, bound to clean source `e47c69754d983d95dc356521b1fc02094aa590b1`. Compared relevant source with main `4144eb94e5dc5fc7065599a6bf1a1613a5bf2c48`, including PR1792 commit `178349813eecbf0edfda79d8f7ef185b0831d500` (merge `6878dadfccc55a866d014f7aa310e9307b36c4b4`). Local technical diagnosis only; no approval or merge verdict.

The native failure is real, and its cause remains unproved. Readiness observation did not fix the original zero movement. No source changes, browser/device execution, new CI runs, security changes or platform messages were performed for this investigation. The controls below are proposed and unexecuted by this reviewer.

Read and inspected:

- `/workspace/scratch/5e512bf106bf/evidence/ci-45383599762/browser-6/contents-command/shadcn-wc-click-wheel.json`
- `/workspace/scratch/5e512bf106bf/evidence/ci-45383599762/browser-6/contents-command/shadcn-wc-click-wheel-failure.png`

Before and after native wheel, retained Content has `clientHeight=776`, `scrollHeight=6230`, `max=5454`, `overflowY=auto`, rect `(8,60,374,776)`, and ready/connected/current-dialog/current-surface all true. The hit is a native `summary` at `(195,448)`. The retained event is trusted, `deltaY=500`, Content/surface are in its dispatch path, and final cancellation is false. Content top and document Y remain zero. Screenshot shows the beginning of the sidebar; the original assertion reports `expected +0 not to be +0`.

The receipt lacks other ancestor offsets, computed ancestor styles, transient scroll events, and focus/mutation chronology. It cannot distinguish a different native scroll owner, default action that made no progress, and progress subsequently reset. Event ancestry alone does not establish the browser's selected scrolling box.

## Source evidence and falsification

Locations below refer to e47 source inspected before the environment loss described at the end. A per-file Git-blob manifest could not be generated after that loss; no such manifest or reconstructed raw evidence is claimed.

| Hypothesis | Source evidence | Bounded conclusion |
| --- | --- | --- |
| Production WC is using split shadow | `apps/www/src/components/PrototypePreviewer/wc-registry.ts:14–21` calls AdaptToWebComponent without `shadow`; `packages/adapters/web-component/src/shadow-profile.ts:13` maps undefined to false. `adapt.ts:290,308–319` uses the ordinary host. | Production registration defaults to light DOM. The shadow comment at `site-contents-panel.ts:265–267` is not runtime proof. Record localName, root/host ownership and split attribute before diagnosing split-only behavior. |
| Old sidebar intentionally remains a second scrollport | `PageFrame.astro:258–276` sets borrowed nav/pane overflow visible, pane max-height none, nav height auto. Old pane overscroll contain remains at209. Shadcn Popover `recipes.ts:70–72` gives Content available height, overflow-y-auto and overscroll-contain. | Source intends Content to scroll. Actual computed values on both axes are needed; retained contain alone does not prove interception on a non-scroll container. |
| Main PR1792 already fixes this owner | PR1792 changes only module-scroll's web host and perf test. Base/Shadcn Popover has no asScrollSurface declaration. ScrollModule starts declared=false (`impl.ts:70`), getSurface declares it (`188–191`), mount attaches only if declared (`359–367`). WC capability installation at `runtime/modules.ts:2760–2781` does not declare it. | PR1792 is not the direct CSS-only Popover scroll owner. The narrow 9527→4144 diff changes no Popover/WC/Contents/PageFrame/Sidebar-visibility/Focus/Overlay file; its only path in this scope is the scroll host. Do not overwrite unrelated performance work. |
| Popover imposes a modal wheel lock | Base Content configures modal:false, nontrapping scope and no restoration (`content.proto.ts:54–80`). Overlay `impl.ts:571–582` only locks when modal=true; its web lock writes body overflow (`web/modal-lock.ts:64`). | No direct modal-lock acquisition from this Content. Still read computed body/root CSS; this does not prove styles of the failing page. |
| Current-article reveal undoes wheel | `site-sidebar-current-visibility.ts:88–94` yields, clears pending work and cancels RAF. Passive wheel listeners exist on nav (`336`) and enclosing owner (`309–314`). Measurement writes are pending/yield guarded (`153–189`); mutations return after yield (`211–238`). | This owner explicitly yields to wheel. Need a positive-then-zero trace before asserting repeated reveal. |
| Home scroll restoration resets mobile Content | `site-contents-panel.ts:67–77` writes offsets only after nav returns home and desktop min-width64rem matches. | This path does not match open mobile receipt. |
| Entry/transport focus scrolls to first link | Base Content single-opening gate and preventScroll:true (`content.proto.ts:229–236`); adapter relocation (`owned-relocation.ts:83–106`) and native lease (`native-content-lease.ts:106–107`) also preventScroll:true. | No direct support here for focus reset. Unexpected later focus elsewhere remains a runtime question. |
| Hover rebuilds native slots | Same-family row update only applies props (`site-native-controls.ts:369–389`); Shadcn Surface renders pure r.slot (`surface/root.proto.ts:257`). WC `runtime/session.ts:812–821,848` leaves an initial light slot-only view's children alone without a projector. Native-link facts has no wheel handler or input cancellation. | Ordinary hover does not establish detach/reinsert. General commitChildren can move children (`commit.ts:278–292`), but its execution for this owner first needs evidence. |

CSSWG work-in-progress references distinguish scroll chaining from event propagation and say non-scroll containers ignore overscroll behavior. Overflow's computed two-axis behavior matters. These semantics are not proof of hosted Chromium's particular action: [CSS Overscroll sections3–4](https://drafts.csswg.org/css-overscroll-1/#scroll-chaining-and-boundary-default-actions), [CSS Overflow section3.1](https://www.w3.org/TR/css-overflow-3/#overflow-properties), consulted 2026-11-24.

## Minimum discriminating native controls

Two fresh pages/contexts, same route/family/runtime/viewport, actual public Popover, original 1000ms movement deadline. Each receives one native mouse.wheel(0,500) from its natural initial offset. No scrollTop assignment, scrolling API, synthetic wheel, nav replacement or overflow/style mutation.

1. Repeat current native summary-center hit.
2. Hit blank Content padding whose read-only hit chain excludes nav/pane/summary and includes Content. Existing p-4 website slot supplies candidate padding; verify before choosing coordinates. If no valid point exists, record that limitation rather than changing layout.

Initially/finally capture node identity, local name, root/host/split ownership, computed overflow X/Y, overscroll X/Y, position/display/contain/pointer-events, client/scroll dimensions and offsets, and html/body styles. Add bounded passive scroll listeners on the measured nodes themselves, bounded focusin/out and relevant childList observations with timestamps. Document capture alone does not observe every shadow scroll event. Instrumentation must not focus, cancel, restore or otherwise change behavior.

| Result | Discriminating implication |
| --- | --- |
| Padding scrolls; summary does not | Descendant chain or hit policy becomes more likely. Compare differing ancestors. |
| Inner ancestor moves while Content stays zero | Native owner differs from observed intended owner; assess product ownership before changing assertion. |
| Content first positive then zero | Correlate reset with focus, mutations, geometry or automatic reveal; endpoint zero alone is insufficient. |
| Both valid hits produce trusted uncancelled wheel with no scroll anywhere | Investigate native Content projection/default action with standalone controls and isolated public-Content fixture; readiness remains insufficient. |

Shard11 native control outcome was not available to this reviewer at cutoff. A control pass establishes its fixture, not public Contents acceptance. No baseline browser comparison was executed by this reviewer, and no causal fix/native acceptance is claimed.

## Evidence availability after environment loss

At approximately 11:46 UTC on 2026-11-24, /workspace reported 100% capacity with zero available bytes. An attempted note write produced only a new zero-byte file; this reviewer removed only that own failed-write file. /tmp had space, so this note was saved there. Shortly afterward the known task directory and repo under /workspace and /tmp were absent, with disk usage dropping to 7% and nearly zero respectively. Root confirmed it had not moved or deleted them. The cause is unknown; the observations are consistent with an execution-environment reset.

This note remained available and readable after that event. The reviewed receipt and screenshot paths above were then unavailable locally; their prior observation is preserved in this narrative, without inventing file digests. GitHub e47 and original CI artifacts can be used by root to restore the durable source/evidence. No other task files were deleted, inspected or modified by this reviewer.
