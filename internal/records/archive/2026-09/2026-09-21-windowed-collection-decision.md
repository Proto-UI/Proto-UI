# Windowed Collection first-slice decision packet

Date: 2026-09-21

Status: non-normative recommendation for #521. This record does not admit a Contract, Module, Host Capability, Prototype, Adapter relation, dependency, implementation, or stable guarantee.

Refs: #513/#514 (Harness/matrix), #519/#623 (merged Scroll end-follow), #520 (away-from-end visual anchor), #521 (this packet), #523 (Tree consumer).

## Recommendation

Advance one later proposal checkpoint for a **one-axis Windowed Collection Module plus lease-shaped Host Capability**, but block implementation until Collection has stable logical item identity/order independent of physical Anatomy membership and Runtime/Adapter has an approved keyed materialization seam.

The first slice supports a complete App-authored logical item sequence while only one bounded contiguous range plus item-count overscan has physical views. It does not own item data, selection, focus, keyboard policy, scroll facts, end-follow, loading, or framework diff keys.

Classification: **next proposal checkpoint with two explicit implementation prerequisites**. No materially different semantic owner remains unresolved.

## Existing authority

- `M-COLLECTION-0001-A/C/D/F`, `C-AS-COLLECTION-0001-C/D/E` and `T-COLLECTION-0002` own explicit ordered logical snapshots, metadata, insert/remove/reorder and nested-domain exclusion. They do not own selection/focus/keyboard/A11y. Current implementation derives membership from physically present Anatomy parts; that is insufficient for a full logical sequence whose views are absent.
- `C-SCROLL-0001-A..E`, `M-SCROLL-0001-A..E` and `HC-SCROLL-SURFACE-0001-A..E` own logical scroll identity, normalized facts/requests and current-view host geometry leases. Windowing must not copy offset/rect/target/controller into portable state.
- Merged #623 / `C-SCROLL-END-FOLLOW-0001` owns append-follow, reader interruption, layout-ready movement and Scroll lease cleanup. Windowing contributes layout/materialization readiness only; it never creates another `atEnd` or following fact.
- `C-ANATOMY-ORDER-0001` describes actual host-observable part order, not absent logical item order. Anatomy remains physical structural evidence and cannot become a virtual item registry.
- `C-FOCUS-0001` / Focus Roving retain focus facts and requests. An ensure-visible request can precede focus, but materialization cannot claim focus applied.
- `C-A11Y-0001` / `HC-A11Y-0001` allow current semantic objects and host degradation. Windowing does not manufacture accessibility objects for unmaterialized items without a separately governed virtual accessibility strategy.

## External evidence boundary

- [TanStack Virtualizer](https://tanstack.com/virtual/latest/docs/api/virtualizer) separates total count, stable key, estimated size, overscan, range extraction, host scroll element/offset/rect observation, item measurement, scroll-to behavior and correction when estimates differ. Its pixel APIs and framework keys are implementation evidence only; they are forbidden portable types.
- [Resize Observer](https://www.w3.org/TR/resize-observer-1/) and [Intersection Observer](https://www.w3.org/TR/intersection-observer/) demonstrate asynchronous host geometry/visibility delivery. They support epoch-bound Host Capability observation, not generic Props or State containing DOM targets/rectangles.
- [UIKit UICollectionView](https://developer.apple.com/documentation/uikit/uicollectionview) keeps App data order in a data source, layout in a layout object, visible items in reusable cells, selection in delegate behavior, and host accessibility/layout notifications. Its reuse and prefetching support the logical-data-versus-view split without proving a shared native implementation.
- [UICollectionViewDataSourcePrefetching](https://developer.apple.com/documentation/uikit/uicollectionviewdatasourceprefetching) explicitly treats prefetch as advisory: every cell provider must work whether data is ready, pending or never prefetched, and stale prefetch can be canceled. Data loading therefore remains App-owned and is not Windowing materialization truth.
- WAI-ARIA `aria-posinset` / `aria-setsize` support reporting an item's position and logical set size when not all siblings are physically present. They are Web projection evidence; a Host Capability may degrade, and they do not create logical identity.

## Required prerequisite A: logical Collection identity

Current Collection snapshots are derived from mounted Anatomy item parts. Windowing cannot preserve a 100,000-item logical set while only 30 parts exist without either lying about Collection count/order or forking Collection ownership.

The proposal must extend or refine Collection through a separately governed plain-data provider:

- stable non-empty item ID unique in one Collection owner;
- complete ordered ID sequence and bounded metadata supplied by App/owner;
- monotonic logical order revision;
- insert/remove/reorder transactions that do not require views;
- no item content, renderer, framework key, file/session object or host reference;
- physical Anatomy item, when present, binds to exactly one current logical ID/generation.

Index alone is insufficient because prepend/reorder changes index identity. Framework keys remain Adapter implementation details derived from stable logical IDs, never portable key objects.

## Required prerequisite B: keyed materialization seam

Current Template/Adapter behavior has no generic internal dynamic-child range materializer. The proposal must choose and test one bounded Runtime/Adapter seam before Windowing implementation:

- Module requests one generation-bound logical ID range;
- App/runtime supplies authored view definitions for exactly those IDs;
- Adapter materializes/removes/reorders views without exposing framework instances;
- same logical ID may receive a new view epoch; old physical callbacks cannot bind to it;
- a failed/partial commit reports unavailable and never publishes the requested range as materialized;
- no universal `key` field is added to every Template node by assumption.

## Ownership split

### Collection retains

- complete logical ID/order/count and App metadata;
- structural insert/remove/reorder revision;
- relationships to selection/focus only through separate contracts.

### Windowing Module may own

- one requested and one committed materialized logical range;
- item-count overscan policy and maximum-materialized-count requirement;
- materialization request/result IDs and per-item view epochs;
- semantic `ensureVisible(itemId, align)` request/result;
- estimate-policy reference and measurement-generation coordination;
- invalid/unavailable/degraded status and bounded diagnostics.

### Host Capability owns

- current viewport/scroll target/controller;
- host offsets, rectangles, pixels, item extent measurement and observation;
- visible-range proposal from private geometry;
- physical leading/trailing spacer or gap projection;
- mapping `ensureVisible` to host scroll rules and returning applied/rejected result;
- observer/listener/controller cleanup and stale-callback rejection.

### App retains

- item data/content/loading/prefetch/cache/persistence;
- stable domain IDs and metadata truth;
- selection/current business meaning;
- transcript/message/file/session semantics;
- empty/error/loading presentation and retry.

## Candidate portable vocabulary

Names are illustrative until a spec proposal:

```text
WindowPolicy:
  axis: vertical                 // first slice only
  overscanItems: non-negative bounded integer
  maxMaterializedItems: positive bounded integer
  estimatePolicyId: opaque App/host configuration reference

WindowFacts:
  logicalCount / logicalRevision
  requestedRange / committedRange (inclusive logical indices + generation)
  status: idle | requesting | committed | unavailable | invalid

WindowRequests:
  materialize(range, generation)
  ensureVisible(itemId, align: nearest | start | center | end, requestId)
```

No extent, pixel, offset, rectangle, DOM element, controller, observer, framework key or view object enters portable facts. `committedRange` means those logical IDs have current views; it does not mean layout, paint, focus or accessibility announcement completed.

## Range and measurement rules

- Host proposes visible logical start/end from private geometry and current measurements; Module validates count/revision/generation and expands by bounded item-count overscan.
- Range is contiguous in the first slice. Sticky/pinned disjoint items, lanes/grids and two-axis windowing are deferred.
- Estimated and observed extents remain host-local. Module carries only an opaque estimate-policy ID and generation/result status.
- Measurements are keyed by `{logicalId, logicalRevision, viewEpoch, layoutEpoch}`. Reorder, item replacement, view rematerialization, estimate-policy change, font/scale/direction/container change or host layout reset advances the applicable epoch and invalidates incompatible measurements. Late callbacks fail closed.
- A first-slice profile must publish finite bounds for overscan and maximum materialized views; unsupported bounds yield `unavailable`, never silent unbounded materialization.
- Host may coalesce range proposals in one layout window, but every accepted materialization or ensure-visible request receives a terminal applied/superseded/rejected result.

## Scroll and end-follow composition

Windowing composes one existing Scroll Surface; it does not own offset, normalized position, input attribution or end proximity.

- A committed materialization result tells the host that physical views changed; Scroll's existing layout-ready path observes resulting extent.
- While the Scroll lease is `following`, merged #623 may schedule its governed end movement. While paused, Windowing changes must not move to end.
- `ensureVisible` is a Windowing semantic request that may ask Scroll/host to reveal one logical item after materialization. It never moves focus and never resumes end-follow unless an independently authored existing `to-end` request does so.
- Prepend/reflow visual-anchor preservation away from end belongs #520, not this packet.

## Focus and accessibility

- Collection/Windowing never owns selection or physical focus.
- A focus request for an unmaterialized item first obtains an `ensureVisible`/materialization result, then Focus issues the host focus request. Failure leaves focus facts unchanged.
- Materialized items expose current logical index and total count to A11y so a Web profile may project `aria-posinset` / `aria-setsize`.
- Unmaterialized items have no physical semantic object in the first slice. The host may expose an independently governed virtual accessibility collection or degrade explicitly; the Module must not synthesize thousands of hidden DOM nodes or fake complete native accessibility.
- Announcements, Live Region ownership and item names remain existing A11y/App concerns.

## Dynamic structure and lifecycle

- Insert/remove/reorder updates the complete logical revision first, invalidates stale requested ranges/measurements and computes a new bounded request from stable IDs.
- Removing current visible views does not emit App selection/focus actions. Focus and selection owners reconcile separately.
- View detach releases materialization and geometry leases but retains logical Collection/Window policy; remount opens a new view epoch.
- Target replacement rebinds observers and gaps before accepting new facts. Terminal disposal cancels pending requests, removes spacers/observers/listeners and rejects late callbacks.
- Host prefetch/data callbacks are App-owned and cannot mark a view committed.

## Slice comparison

| Option | Scope | Disposition |
| --- | --- | --- |
| A. Fixed-height, Web-only helper | Pixels/DOM/framework keys leak into policy; no variable transcript support. | Reject as portable semantic slice; may remain App/private helper. |
| B. Logical range only, App materializes views | Honest but cannot prove standard Runtime/Adapter lifecycle or host geometry contract. | Useful control/fallback, not complete reusable capability. |
| C. One-axis variable host extent + bounded contiguous range | Smallest reusable transcript/log/list job; separates IDs/range from geometry and reuses Scroll. | **Recommended proposal checkpoint after prerequisites A/B.** |
| D. Sticky/disjoint/grid/two-axis/windowed Tree | Adds lanes, pinned items, hierarchy and more accessibility policy. | Defer. |

No third-party virtualization dependency is selected. Implementations may inform tests but cannot choose public semantics.

## Luna adversarial pass (hypotheses, not evidence)

A no-tool Luna run received only the recommendation and returned eight HYPOTHESIS questions. Independent reconciliation produces these dispositions:

1. **Complete order during mutations/filter/lazy resolution:** every App mutation publishes a complete new logical revision before Windowing commits another range. Lazy resolution is excluded; a provider that cannot supply complete IDs/order cannot use the first slice.
2. **Identity provider alone is insufficient:** correct. Prerequisite A also needs transaction/result/error/cancellation rules; prerequisite B owns materialization settlement. Neither prerequisite alone authorizes implementation.
3. **Stable keyed materialization across every Adapter:** unproven and exactly prerequisite B. A failed profile remains unavailable; framework recycling cannot redefine logical identity.
4. **Contiguous range under jumps/reverse/variable extent:** supported only for one-axis ordinary lists. Sticky/disjoint/grid/lane visibility is deferred. Large jumps may converge through estimate→materialize→measure→correct with terminal request status; unloaded content remains App-owned and can reject availability.
5. **Item-count overscan under extreme extents:** valid risk. Host derives the visible proposal from private extent estimates and may request more items only within `maxMaterializedItems`. Blank-risk or exceeded bounds is explicit unavailable/degraded evidence, not silent unbounded expansion. Extent-based portable overscan is rejected because it would import host units.
6. **Font/container/scale/layout invalidation:** valid correction. Measurements now include a host `layoutEpoch` in addition to logical revision and view epoch.
7. **Ensure-visible for absent/unmeasured/filtered/loading items:** absent ID rejects; filtered/loading availability is App-owned; an unmeasured present ID uses a bounded convergence loop and terminal applied/superseded/rejected result. Scroll/end-follow facts change only through their existing owners.
8. **Accessibility/focus/selection without views:** materialized items expose logical position/total; Focus waits for a committed view before requesting host focus; a separate Selection owner may retain logical selection without a view. Windowing itself owns none of those facts.

The pass changes no semantic owner or option-C recommendation. It strengthens layout invalidation, prerequisite completeness, bounded convergence and explicit degradation tests.

## Fake-host falsification

A private plain-data sketch exercised three invariants: full logical count `1000` with visible `20..29` and overscan `2` produced only committed `18..31`; reorder advanced the measurement revision and rejected a stale prior measurement; `ensure-visible(item-900)` neither moved Focus nor changed paused end-follow. **3 tests passed.** This is simulation evidence, not implementation or performance proof.

A later fake-host matrix must add:

- empty/invalid/out-of-range proposals, overscan/max bounds and capability absence;
- prepend/append/remove/reorder with stable IDs and old-index counterexample;
- rapid resize/scroll coalescing, estimate error, measurement replacement and stale epochs;
- materialization partial failure, superseded requests, detach/remount/rebind/dispose cleanup;
- ensure-visible result before Focus request and end-follow paused/following controls;
- A11y logical position/total for materialized items plus explicit degradation.

## #514 and consumer boundaries

PR #563 remains the single Harness matrix carrier. After it lands, update the generic windowed-collection capability row to `research`, link this record, and name prerequisites A/B. Tree #523, Terminal #530 and transcript/log consumers may reference Windowing only as deferred/research; none gains implementation or support automatically.

## Residual risks and exact human decision

Residual risks: no logical-data Collection provider, no keyed materialization seam, no #520 visual-anchor contract, host measurement variance, virtual accessibility degradation and no non-Web executable evidence.

Smallest human decision: **accept, revise or reject a later C/M/HC/T proposal for option C and prerequisites A/B.** Acceptance authorizes spec proposal work only—not a dependency, implementation, Adapter support, public component, #520/#521 merge, Tree/Terminal integration or release.
