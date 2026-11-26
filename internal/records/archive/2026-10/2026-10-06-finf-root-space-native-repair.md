# Native root-space follow-up

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Retained actual observations

Finf head689c5614608b1ec0391a70f6c9f69c8b29361f32, GitHub merge checkout47ece539126714fbaa59b5d3e3c87a90dd3dce61, run37521369232:

- browser5/job112468328136, artifact11440783364, ZIP SHA2563bc1ca85fd202ce76c8fe8e2cf30d73bd9c4662c45da3fd7f38d9e5029f024a3: all56 PNG hashes verified. Real classic scrollbar width15px. In all four runtimes/LTR/RTL, the no→classic Select transition aligned, but restoring no-scrollbar moved the same-size anchor right7.5px while the popup remained stale. Nested size/scroll changes resumed alignment. Dialog body locking retained a root scrollbar but added15px right padding anyway, moving its trigger left7.5px; unlock restored it. These16 failures are product geometry failures, unlike c071's8 zero-scrollbar fixture prerequisite failures.
- browser8/job112468328212, artifact11440138654, ZIP SHA2562c31d948ef93ff4252bc18e82ae6040f1f8a8e81ee508437739ec6d0ee14a929:21 PNG hashes verified. Seven initial390px settled cases had x16,width358,right374 and focus inside, with full-window Mask. Seven journeys subsequently failed at430px while width/left were still transitioning; the probe's two-frame sample did not establish settled geometry. One Shadcn Vue2 journey failed earlier selecting a runtime option. Long text/scale/reopen cases were not reached successfully.

Original partial before/reference, new390 and failed430 frames are publicly retained at evidence commit855de7f24df5f0ca33943d7ff4ba86fb85deb3e1 and PR#872 comment6024523712. Old30d production and new689c dev images are clearly labeled reference-only, not a strict matched comparison.

## Repair boundaries

- Shared active document-root ResizeObserver and root dir/style/class geometry checks notify only when clientWidth/clientHeight/clientLeft changes. AvailableSpace and FloatingUI leases share it, release it at the last subscriber, and never start a perpetual frame poll. Same-size anchors no longer depend only on intersection/anchor-resize observations.
- Body locking measures the actual client-width gain after hiding overflow, splits it using actual client-left change, and preserves original padding/priority through nested owners. A retained scrollbar/stable gutter receives no duplicate padding. Explicit root-owned scrolling remains distinct from this bounded body resource.
- Shadcn/Brutalist Dialog retain their200ms enter/leave animation but restrict CSS transitions to opacity so root-space geometry cannot tween beyond a shrinking viewport.
- Native probes retain early and genuinely settled phases, do not relax the early bounds, wait for published setup before choosing runtimes, and retain setup failure diagnostics. The classic fixture now separately tests body-propagated scrollbar removal, stable gutters, and root-owned retained scrollbars.
- A read-only official matched workflow fixes historical subject15d864de54210c2eebc4f4b2fec6235324989989 and copies the same candidate-owned three-file probe closure to both dev-server subjects. It records actual font samples/DPR/media and keeps all original historical failing assertions. The negative-control verifier accepts only eight exact zero-inset failures with the expected source/routes/fonts/frames, not timeouts, missing frames, successes or killed processes.

## Validation and remaining work

The new retained-gutter and left-scrollbar controls initially failed2/7 and now pass7/7; existing controls stay intact. Shared observer and live FloatingUI tests exercise resize-return, unchanged geometry, origin-only notification, subscriber replacement/removal and cleanup. Current focused tests93/93 and baseline-classifier9/9 pass. Spec status remains draft and real current-source native acceptance remains pending. GPUI, physical keyboard/safe-inset behavior and the complete Finf checklist are not inferred from these controls.

Final bounded checks: workspace and browser-probe TypeScript, prototype catalog, four changed spec authoring inputs,122 runtime-plan/runner controls and both source coverage matrices passed. The production build completed309 pages in31.16 seconds. Its actual import-graph gate failed on reviewed Website entries reaching adapter-base/host/instance-associations.ts; that shared Label/graph integration blocker is retained and assigned to the GPUI/integration owner, not hidden by a widened allowlist. The built tree predates only the subsequent observer error-isolation guard, so it is not called a final-tree full production pass.

Independent limited review re-ran25/25 modal/observer/FloatingUI/two-Dialog controls. A new callback-failure control first showed one failing owner starving a second; the observer now delivers to remaining live owners before rethrowing the original error (or an AggregateError for multiple failures). This preserves visible errors without silently abandoning independent subscribers. The final native source still must run; previous artifact failures remain attached to their original heads.
