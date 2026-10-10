# Menubar navigation request repair (bounded local follow-up)

Date: 2026-10-10 UTC. Base: `8f937f087f68335b17f7243aaa45549e23945526`. Independent worktree: `finf-menubar-single-request`. The frozen sixth snapshot and Runtime Tabs chain are unchanged.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Evidence and authority

The independent exact-source review probe confirmed that one synthetic ArrowRight from an actually focused File command emits two **valueChange** events: `edit/focus-switch` then `edit/horizontal-navigation`. The controlled owner stays File and focus reaches the Edit trigger. The equivalent uncontrolled case emits once. The review's event is not named openChange.

Reference: review `discussion_r4237182489` on PR #872; fixed-source report and observations are retained in the sixth review verification artifacts. This WIP family still lacks a dedicated active P/T single-request guarantee. The bounded repair follows the owner's requested consistency criterion and the existing draft `C-AS-FOCUS-ROVING-0001` / `D-FOCUS-ROVING-NAVIGATION-OWNERSHIP-0001`: sibling keyboard movement stays with roving; the component owns requests and controlled truth remains owner-provided. No stable catalog admission is inferred.

## Root cause and narrow change

The Root's `__navigate` first calls the target's public `focusSelf`. An applied focus synchronously enters the Trigger watcher, which issues the existing `focus-switch` request. The Root then tried a fallback `horizontal-navigation` request. Value equality prevented the second request only for an uncontrolled or immediately accepting owner.

The Root now records a private request revision before notifications. A navigation snapshots this revision before calling focus; if the focus callback or synchronous application reentry has already made a request, it does not emit its fallback or overwrite a newer current member. An unapplied focus still reaches the original fallback. The revision is not a value cache or permanent deduplication window: rejected requests, later independent focus, and repeated explicit application requests remain observable. No props, exposed state, timers or shared Focus/Runtime/Compiler changes were introduced.

ArrowLeft coverage additionally found that `findIndex(open value OR current id)` could select an earlier stale current member instead of the actually open menu. The same function now prioritizes the open owner's value and falls back to current only without an open match. Trigger-level sibling arrows/Home/End are still handled by existing Focus Roving.

## Verification and limits

The initial larger fixture omitted explicit cleanup of portaled parts and contaminated later cases with disconnected Anatomy listeners. That run is retained as a fixture failure, not counted as the intended regression. After registering every owned part and waiting for actual instance disposal, the original 33-case suite had **8 failures / 25 passes** on the unchanged base. The failures included controlled duplicate requests, reentrant/stale continuation and the ArrowLeft start error.

The repaired focused suite has **35/35 passing**. It covers command Left/Right, trigger Left/Right/Home/End, controlled refusal and immediate/deferred acceptance, uncontrolled state, closed focus-only movement, content-local Home/End, repeated independent same-value requests, direct focus changes, synchronous application request/focus reentry, disabled targets, disposal during a callback, and an explicitly injected refused host focus. The latter distinguishes fallback from applied-focus requests; it is not native input or delayed-host-ready evidence.

Correctly selected combined suite: `menubar-request.test.ts` (35), `menus.test.ts` (7), `navigation-link.test.ts` (8). Scoped TypeScript includes the shared menu family, Menubar/Navigation APIs and new tests. An earlier command used the non-existent `native-link.test.ts` filter and collected only 42 tests; that was not counted as Navigation Link coverage and was rerun with the actual file.

RTL-host cases cover request cardinality under the current physical arrow policy. Menubar has no direction API and Focus Roving exposes no RTL direction input; logical mirrored arrow navigation is **not implemented or admitted** by these tests. This separate shared-contract gap remains for its owner; no DOM direction lookup or second keyboard owner was added here.

All keyboard input is synthetic and focus is observed through the actual WC/Focus host protocol in HappyDOM. No native browser/AT/GPUI, screenshots, packed consumer or full CI claim. Normal hooks and DCO are required for this local source commit. External publication remains paused.
