# Retire material resources on owner-document adoption

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Verified scope

PR #872 discussion `4216274706` identified a real document-lifetime mismatch: `createWebMaterialSink` pinned the original Window, default media preferences, GPU pool and geometry observer while the physical host could be adopted into another Document. A later frame could sample destination source admission but use the old window's DPR and old resource subscriptions.

The public sink now retains view/frame ordering across document-bound physical bindings. On a detected adoption it fully releases the old binding before recreating destination Window/preferences/GPU/image/geometry resources and replaying only current intent. Source, palette, contact, scheduled frame, context-loss and image-completion paths check the physical document before using the binding. Retired callbacks return without changing destination paint. The existing release path uses the captured old window to cancel its RAF, calls old subscription disposers, releases the old program pool lease, and restores only owned paint and diagnostics. This is not a reassignment of resource handles.

Author paint takeover belongs to the retained host/view, so its set survives rebinding. Contact motion is stopped during retirement and keeps the rejected session identity, preventing a later old-session move from reviving it. A fresh router session can resume motion. Reentrant provider cleanup commits retain the latest frame until cleanup finishes; release during new subscription retires the partially acquired binding instead of resurrecting the view.

This implements draft `C-VISUAL-TRANSACTION-0001-IDENTITY/STALE/LEASE`, `HC-FEEDBACK-VISUAL-SINK-0001-LIFETIME`, and `C-FEEDBACK-MATERIAL-0001-CONTACT/SAFETY`. It changes no stable support claim, prototype semantics, material policy, public sink interface or portal routing.

## Evidence and limits

- Final red baseline on the reviewed external-paint repair source: seven of the nine new adoption controls fail, with two existing-behavior negative controls passing. This red was collected after correcting the fixture limitation below.
- Candidate: nine adoption controls pass; the focused 12-file material/pointer regression set has 107 passing tests.
- Real Happy DOM Documents, separate iframe Window objects, actual `Document.adoptNode`, actual MutationObserver delivery, actual geometry subscription cleanup, and the real per-document program-pool ownership are exercised. GPU rendering, image decoding, media facts, dimensions and RAF scheduling are controlled doubles, not native rendering evidence.
- Controls cover old observer/context/preference silence, destination changes, DPR 1 -> 2, destination safety veto before enhancement, stale decode rejection, frame/view ordering, author takeover, old contact rejection/new contact recovery, reentrant commit, subscription-time release and terminal teardown.
- Happy DOM 15.11.7's `adoptNode` only changes the supplied node and makes its `ownerDocument` property nonconfigurable. The fixture therefore adopts each of scope/canvas/host through the real API and checks their destination identity. Native subtree adoption and repeated document round trips remain browser CI debt; no property mock or simulated pass replaces them. An earlier round-trip attempt failed at Happy DOM's second adoptNode, not in the product code.
- Node 24.19.0 / pnpm 10.32.1 / Vitest 2.1.9; one test worker. Full `check:types` passes, including workspace and 578 docs files (0 errors, 0 warnings, 7 existing hints). All nine canonical local package budgets pass; React 105839, Vue 105687, WC 131463 gzip bytes. Official exact-head CI is still required; local measurements are not production/native evidence.

The baseline includes the separately reviewed external-paint conflict and persistent author-ownership fixes. Those remain distinct commits. No rejected portal experiment or self-optical CSS initialization change is included. Independent review and remote publication remain separate. No native screenshot was generated for this resource-lifecycle correction; native adopted paint and round-trip evidence remain open.
