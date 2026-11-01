# Visual-anchor preservation (away-from-end) first-slice decision packet

Date: 2026-09-22

Status: non-normative recommendation for #520. This record does not admit a Contract, Module, Host Capability, Prototype, Adapter relation, dependency, implementation, or stable guarantee.

Refs: #513 (Harness/matrix), #519/#623 (merged Scroll end-follow), #520 (this packet), #521 (windowed Collection, merged 2026-09-22 as `internal/records/2026-09-21-windowed-collection-decision.md`), #523 (Tree), #530 (Terminal).

## Recommendation

Advance one later proposal checkpoint for a **bounded anchor-preservation transaction as a Module-owned and Runtime-orchestrated, host-applied capability**, shaped as a lease over an existing `HC-SCROLL-SURFACE-0001` session. The transaction is:

```text
capture anchor intent (logical identity + captured host-local offset)
→ application/collection structural update occurs
→ host resolves the current materialized anchor target
→ layout settles
→ host applies the minimum position correction
→ terminal result: applied / degraded / rejected / superseded
```

The first slice serves fully materialized single-axis scroll surfaces. It composes, and never replaces, the merged end-follow lease: while `following`, position ownership stays with end-follow (#623 / `HC-SCROLL-SURFACE-0001-H..J`) and a preservation request is rejected, not queued.

Anchor identity is a **logical reference** — a Collection item ID or a scoped surface landmark handle. It is never a DOM node, framework key, rectangle, or raw offset. Captured state may carry one host-local scalar (the offset above the anchor at capture) inside the lease; it never enters portable facts.

Classification: **next proposal checkpoint**. No materially different semantic owner remains unresolved for the first slice; the open dependency questions below resolve to existing entities rather than new forks.

## Existing authority

- `C-SCROLL-0001-A..I` and `M-SCROLL-0001` own the logical scroll surface, normalized facts/requests, the host-session/view-epoch boundary and the rule that prototype authors must not read or write raw host scroll targets (`C-SCROLL-0001-D`). Anchor preservation must be host-applied; an app reading rectangles before/after render and mutating raw scroll position is exactly the ungoverned path this packet forbids.
- `HC-SCROLL-SURFACE-0001-A..J` owns target resolution, layout-ready facts, validated request application, clamping delegated to host rules, session disposal with stale-callback rejection (`D`), and the end-follow lease with coalesced end application (`H`), evidenced pause/resume (`I`) and cleanup (`J`).
- Merged #623 / `C-SCROLL-END-FOLLOW-0001` owns append-follow, reader interruption and layout-ready end movement. Anchor preservation is the **away-from-end** complement: it never creates, pauses or resumes an end-follow fact.
- `C-AS-COLLECTION-0001-A..E` and `C-ANATOMY-ORDER-0001` own host-observable item order and structural change response. The windowed Collection record (#521) defines the logical-ID, monotonic-revision, mutation-transaction and host-free-metadata prerequisite (its prerequisite A) that anchor identity will reuse. **These identity/revision/successor surfaces do not exist today**: `C-AS-COLLECTION-ITEM-0001` currently guarantees only index, total, first, last, and metadata (`packages/core/src/collection.ts:6-13,42-68`), and `packages/modules/collection/src/create.ts` exposes no governed item ID, predecessor/successor transaction, or historical revision. The first-slice proposal below therefore gates on landing that governed identity layer (merged sibling #677 makes that capability explicit); anchor preservation cannot ship against declared-only identities.
- `C-FOCUS-0001` / Focus and `C-A11Y-0001` retain focus and accessibility ownership. Anchor correction must not move focus; degraded results are reported, not silently swallowed.

## External evidence boundary

- [TanStack Virtualizer](https://tanstack.com/virtual/latest/docs/api/virtualizer) exposes `scrollToIndex`/`scrollToOffset` and measures item sizes to keep a visible item stable across changes. Its pixel and DOM APIs are implementation evidence only; they confirm the host-applies-shape, not a portable type.
- Browser scroll anchoring ([scroll anchoring](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll_behavior/Scroll_anchoring) / Chrome implementation) is a browser heuristic: it picks a candidate node, measures its distance before/after reflow, and applies the minimal correction. It is per-browser, non-portable, non-observable and cannot express "this logical item is the anchor". It proves the minimum-correction mechanic is standard, and that an explicit, portable, testable anchor is a distinct governed capability.
- UIKit `UITableView`/`UICollectionView` keep the app data order in the data source and reposition the visible rows so the previously visible row keeps its on-screen position after `insertRows`; the framework owns the geometry correction. Same split: logical identity in the data layer, geometry in the host.
- WAI-ARIA APG list/disclosure patterns require that programmatic content changes do not move focus or lose the user's place. They set the a11y floor: no focus movement, preserved place, explicit degradation.

## Ownership split

### Collection retains

- stable logical item identity and order — **declared items today only**; the #521/#677 governed logical-ID, monotonic-revision, and host-free-metadata provider is a landing prerequisite for this slice, not an existing surface;
- predecessor/successor resolution for anchor removal — **provided by the revision-bound transition oracle required by rule 6; does not exist today**;
- structural revision — **a governed mutation-transaction surface that must land with (or before) the #677 identity layer; the current Collection module exposes no revision surface**.

### Anchor-preservation (proposed Module/contract slice) owns

- anchor intent capture and its terminal transaction lifecycle;
- the anchor reference type: logical item ID, or scoped surface landmark handle;
- validation rules: capability absence, stale epoch, active-user cancellation, anchor absence;
- result vocabulary: `applied | degraded | rejected | superseded`;
- policy that the first slice supports one-axis fully materialized surfaces;
- no pixel, offset, rect, DOM, framework key, controller, or observer in portable state.

### Scroll Surface host capability (existing, extended) owns

- target resolution and layout-ready measurement of the anchor's host-local offset;
- minimum correction computation and application with host clamping;
- degraded successor placement;
- stale-epoch rejection and lease cleanup;
- coexistence rule: end-follow `following` rejects preservation, never defers it.

### App Maker retains

- fetching/inserting history, expanding details, reordering;
- deciding whether an update requests preservation;
- which authored item or landmark is the anchor;
- error/retry for the underlying content operation.

## Candidate portable vocabulary

Illustrative until a spec proposal:

```text
AnchorRef:
  kind: logical-item | surface-landmark
  id: stable non-empty string (item ID or authored landmark ID)

AnchorCapture:
  anchorRef
  requestId

AnchorPreservationFacts:
  status: idle | captured | applied | degraded | rejected | superseded
  terminalReason: capability-absent | stale-epoch | user-scroll-active
                 | anchor-absent | end-follow-following | layout-unsettled

AnchorRequests:
  captureAnchor(anchorRef, requestId)
  preserveAfterUpdate(requestId)      // application update has been committed
  releaseAnchor(requestId)
```

No extent, pixel, offset, rectangle, DOM element, controller, observer or framework key enters portable facts. The host-local captured offset lives only inside the lease.

### Proposed transition and result table (timeout bound unresolved)

States: `idle → captured → (settling) → terminal`. Exactly one terminal status+reason per request; the terminal row wins over every in-flight event; after a terminal result the lease is closed and every later callback is a no-op that is logged, never a state change. Timeout boundary remains an unresolved proposal input: `HC-SCROLL-SURFACE-0001` governs session lifetime, layout readiness, coalescing and cleanup, but does not define a settling-timeout bound that this proposal can inherit. The later C/M/HC/T proposal must govern the bound and its observation basis, including the rematerialization window, before timeout cases are test-ready. Expiry is proposed to return `rejected: layout-unsettled`; no duration or existing end-follow timeout is claimed here.

| # | Event in state `captured` | Result (status: reason) | Movement |
| --- | --- | --- | --- |
| T1 | App commits update; expected post-commit generation settles | `applied` | minimum correction once |
| T2 | Second `captureAnchor` on the same surface | prior: `superseded: re-captured`; new capture proceeds | none |
| T3 | Active user scroll begins | `rejected: user-scroll-active` | none |
| T4 | Viewport resize/zoom/reflow arrives | `rejected: viewport-changed` | none |
| T5 | End-follow lease is `following` | `rejected: end-follow-following` | none |
| T6 | Anchor removed; transition oracle resolves a successor | `degraded: successor-applied` | successor placed at captured offset |
| T7 | Anchor removed; oracle unresolved or ambiguous | `degraded: successor-unresolved` | none |
| T8 | Anchor dematerialized after valid capture (windowing) | wait bounded rematerialization window → `applied`, else `degraded: anchor-unmaterialized` | correction only on rematerialization |
| T9 | Target replaced / detached-remounted / disposed | `superseded: target-replaced` | none; late callbacks never mutate the replacement lease |
| T10 | Callback from any generation except captured and its expected post-commit successor | `superseded: stale-generation` | none |
| T11 | Settling window exceeds its later-governed timeout bound (unresolved) | `rejected: layout-unsettled` | none |
| T12 | `releaseAnchor` before terminal | `superseded: released` | none |
| T13 | Capability absent at capture or during settling | `rejected: capability-absent` | none |

Outcome precedence when competing events co-occur in one settling window: terminal states already reached win (T2/T9/T12/T3/T5 are terminal at the moment they are observed); if two competing events are observed in the same callback, the safety order is `user-scroll-active > viewport-changed > target-replaced > end-follow-following > stale-generation > layout-unsettled` — the earliest observed event in that order fixes the single terminal result. `applied` never competes with a rejection: if any rejection event is observed before the settled measurement is applied, the rejection wins. This table is a proposed outcome map for a later C/M/HC/T proposal, not a complete test-ready contract while the timeout bound remains unresolved; the later T-\* mapping and fake-host matrix must cover each admitted row.

## Transaction rules

1. Capture is valid only while the surface view epoch and target are current; capture on a disposed/unresolved surface yields terminal `rejected: capability-absent`.
2. The application commits its structural update before `preserveAfterUpdate`; the host measures after layout settles (layout-ready per `HC-SCROLL-SURFACE-0001-B`), then applies the minimum correction: exactly the change of extent before the anchor.
3. Minimum correction means no smoothing: a single step to the preserved position. Reduced-motion must not prevent the immediate correction (per #520 a11y rules); any optional smooth animation is a separate presentation concern (see #685) and must be skippable.
4. Active user scroll (evidenced host input per `HC-SCROLL-SURFACE-0001-I`) takes precedence: the request terminates `rejected: user-scroll-active` and the host position is untouched.
5. While an end-follow lease is `following`, preservation terminates `rejected: end-follow-following`; end-follow remains the sole position owner. While paused, preservation applies.
6. Anchor removal: degrade to the **revision-bound transition oracle** — a Collection-owned transaction record that deterministically maps the removed pre-update anchor identity to one valid committed-revision successor, resolved from the structural transaction itself rather than from post-removal current-order lookup. The successor is placed at the anchor's captured viewport offset, and the result is `degraded`. Without a transition-oracle answer (no recorded successor, or an ambiguous reorder+remove), the result is terminal `degraded: successor-unresolved` with no movement; the transaction never guesses from post-update order. No successor: terminal `degraded` with explicit reason, no movement.
7. Epoch rules: target replacement, detach/remount, or dispose invalidates the capture; late callbacks terminate `superseded` and never mutate the replacement lease (mirrors `HC-SCROLL-SURFACE-0001-D/J`). **One explicitly correlated post-commit layout generation is the expected measurement window, not an invalidation**: the structural update that the transaction itself wraps advances the layout generation exactly once, and that expected generation is the one the capture remains valid for. Stale callbacks from generations other than the captured generation and its expected post-commit successor terminate `superseded`.
8. Exactly one terminal result per request. Coalesced structural updates within one layout window produce one correction.
9. Focus is never moved by correction. A focused anchor that is removed/replaced is handled by the Focus owner separately; preservation reports its result without claiming focus.

## Composition with windowing (#521)

The first slice targets fully materialized lists. It **requires prerequisite A's governed logical identity, revision, and mutation transaction**, as stated above, but does not require prerequisite B's keyed materialization seam or the Windowing Module itself. When windowing lands, the same transaction composes: a _new capture_ of an already-unmaterialized ID is terminal `rejected: anchor-absent` (the App decides to materialize first via `ensureVisible`, then re-capture). **Dematerialization after a valid capture is not removal**: per merged #677 (lines 38–47 and 145–148), a still-present but temporarily unmaterialized logical identity survives view detach/rematerialization. The existing capture preserves its logical identity and takes a materialization-specific outcome — it waits on a bounded rematerialization window within the lease and otherwise terminates `degraded: anchor-unmaterialized` without switching the user's anchor to a successor. Successor degradation is reserved for terminal logical removal (transition-oracle case, rule 6). No portable fact changes.

## Luna adversarial pass (hypotheses, not evidence)

A no-tool Luna run received only the recommendation and returned these HYPOTHESIS questions; independent reconciliation:

1. **Variable-height async content (code/image render after update):** valid. The correction must run at layout-ready after the content's own size change; the transaction stays open until that layout settles, within a bounded lease timeout, then terminates `layout-unsettled`-rejected rather than guessing. Late image loads after the terminal result do not re-open the transaction; a new capture is explicit.
2. **Anchor at the very start/end and clamping:** valid. Minimum correction is clamped by host rules; at the top, correction is zero and the result is `applied` with zero correction. At the end with end-follow paused, the correction may move away from end — that is the intended away-from-end behavior and must not resume follow.
3. **Two anchors / nested updates:** out of the first slice. One capture per surface; a second capture supersedes the first (terminal `superseded`).
4. **RTL/reversed axes:** the first slice supports vertical ordinary axes only. Horizontal, RTL, writing-mode, and reversed-axis semantics are **unavailable and ungoverned** in the first slice — `C-SCROLL-0001-Q-DIRECTION` is an open question that explicitly blocks horizontal-scroll-conformance, so this packet does not normalize against it or claim it as authority. When that question resolves, a bounded follow-up may extend "extent before anchor" to the configured axis direction of the resolved semantics; no second semantics is introduced here.
5. **Viewport resize/zoom/reflow (Issue #520 required case 10):** **not a first-slice preservation trigger, and this packet explicitly requests narrowing #520's acceptance surface accordingly.** The governed transaction is requested only around app-committed structural updates (case 1–9, 11); reflow caused by viewport resize, zoom, or non-app reflow is host/browser behavior outside this lease, exactly as native scroll anchoring already handles it without a portable anchor concept. Concretely: a resize/zoom event that arrives while a preservation transaction is open takes the same precedence as active user input — the transaction terminates `rejected: viewport-changed` (no correction, no guessing), and the App must re-capture. The responsive-resize and 200% zoom real-Web evidence items in #520 remain **open #520 acceptance items, deferred to a separately governed follow-up slice** (they exercise scroll-clamping and end-follow composition, not anchor identity), not silently dropped: this packet proposes amending #520 to mark case 10, the responsive-resize/200%-zoom evidence rows, and the zoom/reflow-evidence boundary row as `deferred to a follow-up anchor-viewport slice`, keeping them visible rather than removed. This deferral itself is the human decision recorded in Residual risks; nothing here narrows #520 unilaterally.
6. **Screen-reader virtual cursor:** investigate, do not infer (per #520). Web evidence: native scroll anchoring does not move the focus/AT anchor. Non-Web hosts: capability absence is terminal, not degraded.

The pass changes no owner and no recommendation. It adds the layout-settle timeout, supersede-on-recapture, and explicit "no re-open after terminal" rules.

## Fake-host falsification

A private plain-data sketch (outside the repository) exercised eight invariants: prepend-one applied the exact minimum delta and preserved the anchor's captured viewport offset; prepend-many coalesced into one terminal result; anchor removal degraded to the logical successor at the captured offset; active user scroll rejected without moving position; stale-epoch late callback terminated `superseded` without mutation; missing capture rejected; away-from-end correction applied even at end (end-follow paused); and end-follow `following` rejected while keeping end-follow position. **10 tests passed.** This is simulation evidence, not implementation or performance proof.

A later fake-host matrix must add: bounded layout-settle timeout; supersede-on-recapture; zoom/reflow non-trigger; RTL axis normalization; capability-absent terminal; and multi-update coalescing across one layout window.

## Residual risks and exact human decision

Residual risks: no non-Web executable evidence; host measurement variance across engines for the layout-ready moment; degraded-successor choice may surprise apps with non-trivial successor semantics; virtual accessibility for AT cursors is investigated-only, not guaranteed; no smoothing/transition guarantee (deferred to #685).

Smallest human decision: **accept, revise or reject the proposed deferral of #520 case 10 and its responsive-resize/200%-zoom evidence to the follow-up anchor-viewport slice.** Until that owner decision, those acceptance items remain open and unchanged. A later C/M/HC/T proposal must also settle the timeout bound and its observation basis; the existing Scroll Surface capability supplies neither that duration nor approval of the proposed outcomes. Acceptance of this decision packet authorizes spec proposal work only — not a dependency, implementation, Adapter support, public component, end-follow change, #521/#523/#530 integration, or release.
