# Material paint-footprint definition slice

Date: 2026-10-30 Issue: #1052; related fixture diagnostics #1053. Inspected main: 50de26ce12ceef93ff4c257fb3d91e363abadfa9. Status: static definition candidate; no new source execution, optical pass or stable admission.

## Selected responsibility and proposed narrow interfaces

Use an explicit independent reservation part, not arbitrary ancestor padding. The layout owner declares a `paintReservation` association with opaque `target` and `part` references. This is a proposed declaration name, not an existing API. The part is a dedicated layout-owned box with no input or accessibility semantics. Consumer padding remains consumer-owned. Native CSS layout can implement the reservation if it satisfies the independently measured footprint; otherwise a single thin host lease owns observation and updates. The target's border box must not be resized to manufacture space.

The proposed host-local footprint result is either:

- `ready`: `top/right/bottom/left` finite nonnegative extents, bound to target, view generation and profile/geometry revision;
- `unavailable`: a categorical reason such as missing capability, detached or zero-sized target, unsupported paint/transform, stale revision or ownership loss. No target coordinates, contact identity or measured pixels enter portable State/props/Context. A genuinely declared border-box-only profile can yield zero; unknown cannot. Do not register the unrelated draft material-contact module.

For existing Anchored Positioning, propose an optional connection association `visualGap: { anchorPaintTarget, floatingPaintTarget, clearance }`. The targets are opaque owned handles, not DOM queries; clearance is a semantic nonnegative host-logical length. In omission mode everything stays unchanged. In opt-in mode the host first projects each expanded paint rectangle into the coordinate frame of its actual positioning reference (anchor or floating). For reference R and expanded paint P, conservative effective edges are `top=max(0,R.top-P.top)`, `right=max(0,P.right-R.right)`, `bottom=max(0,P.bottom-R.bottom)`, `left=max(0,R.left-P.left)`. This includes a non-coincident Surface's internal offset and overflow; it does not simply add the Surface profile outset to Content geometry. Unsupported projection is unavailable, not a claim that the boxes coincide. Both reference and paint geometry revisions participate in invalidation. Required border-box separation for resolved side s is `max(sideOffset, anchorEffective[s] + floatingEffective[opposite(s)] + clearance)`. This preserves an already larger explicit sideOffset while ensuring paint separation; it does not silently reinterpret default sideOffset or add both distances twice. Existing alignOffset/strategy/focus/Portal semantics remain. Names and exact type realization are reviewed here before any core API edit.

A categorical visual-clearance result belongs to the current connection: `ready` or `unavailable`, not exposed raw geometry. Unavailable can use ordinary border-box placement to keep Base interactions working, but the opted-in material path must retain opaque fallback; lack of a result is not ready. The eventual material/positioning handoff must explicitly realize this fallback dependency before the feature is called implemented. It is not an assumed API.

## Main50 ownership map

Select Root owns selection context; Trigger owns its input and pointer-contact material. Content owns portal/positioning/lifecycle and no material slot. Surface alone owns popup paint and complete fallback; Viewport alone scrolls. Thus visualGap floatingPaintTarget is the explicitly related Surface, while floating remains Content. In-flow reservation surrounds the Trigger target without splitting the original framework tree or Tabs context. Button and Toggle can use the same reservation declaration; no Select-name dispatch is admitted. Popup Surface must not inherit a contact budget unless its own material profile declares that behavior.

## Acceptance matrix (all new rows planned)

1. Pure profile bounds: asymmetric four-edge facts, finite domain, whole supported press/drag interval, explicit border-only zero and independent static profile.
2. Reservation ownership: unique pair, wrong owner/duplicate/nested ambiguous relation rejected before effects; consumer padding and target border box unchanged; no ancestor search or added focus/control.
3. CSS/native vs lease: equivalent final extents, target-only measurements, unchanged-value suppression, no reservation self-feedback; constrained layout unable to fit becomes unavailable, not unbounded growth.
4. Positioning: four resolved sides with asymmetric extents, RTL align, offset/overflowing child Surface normalized to its Content reference, max(sideOffset, effectivePaint+clearance), flip recomputes opposing edges, shift and viewport bounds include visual paint. Ordinary no-opt-in output unchanged.
5. Lifetime: resize while open never restarts Overlay entry; replace paint part, same-node new generation, close/reopen and provider change invalidate pending calculations. Reentrant callback/disposal cannot erase successor state.
6. Safety: unavailable facts preserve fallback and Base focus/selection/dismissal. Keep source-overlap/expanded-source/clip/preference/freshness guards and actual optical thresholds. Empty zero-area boxes versus border/shadow/pseudo/visible overflow descendants require separate controls, never blanket exemption.
7. Native: four Web hosts, all four existing Select examples, long RTL/200% text, narrow viewport, real DPR and open resize/flip; Button/Toggle hit target, accessible identity and geometry unchanged. Full optical sequence remains required, not just menu idle.
8. Cost: actual observer/lease counts, callbacks/writes per change, frame latency, repeat mount/open/close/dispose and renderer/canvas resources. Nominal RGBA bytes are not measured GPU memory.

## Evidence and unresolved implementation work

Old e3 receipts show Trigger source-overlapping-content at real 8px gaps against 9px conservative contact outset; old menu remains optical and advances frames. They are not results for this definition, new main50 or a future combined tree. The new planned test entries have no invented executable path or passing status. Existing positioning test statuses are retained as historical catalog evidence, not used to satisfy these new cases. Before implementation: agree exact public declaration/connection type and host-local unavailable-to-material-fallback handoff; choose the smallest CSS reservation realization or one lease; coordinate fresh source claims. No generic observer bus, new runtime, page observer or source guard relaxation.
