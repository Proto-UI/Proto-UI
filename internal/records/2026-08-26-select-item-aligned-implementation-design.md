# Select item-aligned positioning implementation design

Non-normative record. Refs #496. This is an unauthorized proposal — #496 has no implementation checkpoint. Does not create a stable spec guarantee or authorize merge.

## Proposed API

Candidate: extend the existing Content `position` prop (`'popper' | 'item-aligned'`, already in Shadcn Select) to Base Select Content. When `position === 'item-aligned'`, Select resolves the selected Item semantically and requests a descendant-alignment positioning policy. This API and policy are not admitted until the checkpoint in **Status** revises the affected draft entities.

## Selected-target channel and lifetime

The generic positioning host cannot discover the selected Select Item by querying DOM structure or Select-specific attributes. The candidate information path is:

1. Select reads Root's existing value truth and resolves the matching Item as an author-safe Anatomy `PartView` identity.
2. A new privileged Overlay/Positioning policy channel accepts that semantic identity; it does not accept or expose a raw host target to prototype code.
3. Positioning uses an Anatomy module-internal resolver to turn the identity into an opaque selected target and passes that target in the host connection beside `anchor` and `floating`.
4. The target binding is scoped to the active Content view epoch and positioning lease. Replacement, detach, selection change, or disposal revokes the old binding and its observers before another target is attached. Each binding advances a monotonic target generation, and every geometry request under that binding advances a separate monotonic computation sequence. Every asynchronous geometry operation captures the lease, target identity, target generation, and computation sequence before measuring and rechecks all four after every `await`; a completion may publish only if it is still the newest request for that unchanged binding. A stale completion must not write coordinates, available-size variables, or resolved side/alignment even when its target and generation remain current.

This requires an explicit typed connection/policy field and module-internal resolver. It must not be implemented as Select-specific DOM querying in `floating-ui-host.ts`, a public `PartView.getRootTarget()`, or an author-visible context value. Empty/unmatched selections and a target that is absent at the concrete opening-readiness checkpoint below use the existing popper policy.

## Opening readiness and provisional paint

Target readiness is not a timeout. The candidate policy introduces one `partsReady` signal for each `(open-attempt generation, view-epoch generation)` pair, emitted after the adapter's first post-render commit for that pair, when descendant Item registration for that commit is closed. An open-attempt generation is distinct from the Content view epoch: it advances on every close initiation and every open initiation, including a close-to-open reversal while the same portaled view and positioning lease are retained. A view detach/reattach or replacement advances the view-epoch generation and requires a new signal even when the open attempt and Proto instance are retained; React StrictMode layout-effect replay is one required instance of this rule. Readiness signals, reveal commits, focus work, target bindings, and positioning computations capture both generations and may publish only while the exact pair remains current. Closing invalidates the attempt immediately; reopening cannot reuse a consumed or unconsumed signal from the prior attempt. Replacing a view epoch likewise invalidates the prior epoch's signal and work, and the replacement epoch cannot remain waiting on the already consumed signal. A leave reversal retains already committed coordinates as its provisional placement, but must receive the new pair's `partsReady` signal and a current-pair computation before it can complete the new entry.

The adapter/runtime attach path must explicitly request the update that produces this first post-render commit after descendant registration closes; an event dispatch, retained epoch, state write, or implicit subscription notification alone is not a readiness trigger. If that explicit update cannot be issued, the typed terminal capability outcome in the following boundary reveals Content through the existing graceful fallback instead of waiting indefinitely.

The hidden sizing middleware must receive the captured lease, target generation, and computation sequence, and validate them before every available-size variable or constraint write. A stale middleware callback is not permitted to mutate CSS variables even if its enclosing `computePosition()` promise is later rejected.

Available-size constraints must be derived from the descendant-aligned target geometry and the constrained scrollport, not only from the pre-alignment popper side. The host may clamp the aligned target-centered interval or fall back to the existing popper policy when that interval cannot fit; it must not size against stale pre-scroll or pre-alignment coordinates.

On first mount, Content remains `visibility: hidden` and non-interactive until the current signal is consumed and the first aligned or popper computation commits; this prevents a visible provisional popper frame followed by an unexplained alignment jump. Entry focus is likewise gated on that reveal commit: the existing delayed entry task must not consume its one focus attempt while Content is still hidden. The current-attempt selected-or-boundary focus runs, or is explicitly retried, only after the committed coordinates and visible/interactable state are observable, and is cancelled on close, attempt replacement, or epoch replacement.

If the selected Item is unavailable when that attempt/epoch pair's `partsReady` signal is consumed, popper fallback is sticky for the rest of the attempt. A later mount of the same selected Item does not silently change policy after reveal. An explicit selection change that is committed while the popup remains open starts a new target generation and may request descendant alignment for the new selection. Detach, close, attempt replacement, or epoch replacement invalidates an unconsumed readiness signal and any in-flight computation. This boundary must be implemented as an adapter/runtime readiness contract, not as `setTimeout`, an arbitrary task count, or animation-frame polling.

The readiness barrier must also have a typed terminal result. If the positioning module cannot acquire `ANCHORED_POSITION_HOST_CAP`, or the acquired host cannot support either descendant alignment or the existing popper policy for this connection, attach reports that terminal outcome synchronously to the current attempt rather than returning silently. Content then reveals through the repository's existing capability-absent graceful layout, enables interaction, and runs the reveal-gated entry-focus path; it must not remain permanently hidden. A host that supports popper but not descendant alignment reports popper fallback and commits that placement normally. These outcomes do not claim aligned positioning in an unsupported adapter.

## Host-local geometry measurement

Per `C-ANCHORED-POSITIONING-0001-A`, prototype authors and generic modules must not measure host geometry. All measurement stays in the positioning host after the privileged target channel has supplied an opaque target:

1. During the unrevealed opening computation, or an explicit selection-value rebind, the host first runs a hidden sizing pass through the existing available-size policy. That pass writes the current available-size variables and applies the actual Content constraints, including Shadcn's `max-height`, without revealing Content or publishing final alignment coordinates.
2. Only after the constrained scrollport exists may the host test whether the selected target is visible and, when needed, scroll it into view without exposing `scrollTop` or rectangles to Select. If it cannot do so, the lease uses popper fallback. Ordinary recomputation after reveal never repeats this forced scroll.
3. After any sizing or scroll mutation, the host remeasures the anchor, constrained floating root, scrollport, and selected target in one host-local coordinate model. It must not reuse rectangles captured before sizing or scrolling.
4. A descendant-alignment middleware computes coordinates that align the selected target center with the trigger center; it must not encode this as the existing placement's positive `sideOffset`.
5. Collision resolution may clamp or abandon descendant alignment and use the existing popper policy. Only the current request's final aligned or fallback computation may publish coordinates and release the reveal barrier.

The prototype does not measure items, report offsets, or add geometry context values.

## Placement, collision, and fallback

- Descendant alignment is a coordinate policy, not a bottom-only `sideOffset` formula. It must resolve correctly for the configured and resolved side or deliberately fall back to popper for unsupported horizontal or flipped cases.
- Collision handling must evaluate the aligned coordinates and then either clamp them or fall back to the existing popper `flip`/`shift` chain; the current generic `flip` middleware alone does not define this policy.
- Variable-height items use actual host measurements, not a uniform item height.
- Empty or unmatched selection uses popper positioning.
- After Content is revealed, only an explicit selection-value change whose semantic transaction commits with Content remaining open starts a new target generation. This combined Item-to-Root value/open transaction is a proposed change to the current separate `requestValue` then `requestOpen` protocol, not a behavior already admitted by this record. Item activation carries its effective `closeOnSelect` intent through the proposed Root arbitration boundary: a closing selection freezes the committed placement, cancels pending rebind work, and begins leave without forced scrolling or alignment to the new row. A controlled or `closeOnSelect=false` change may rebind only after the state commit confirms that the current open attempt remains active. If that newly selected target is already registered, the lease rebinds and requests alignment; if it is unresolved, popper remains sticky for that selection until another qualifying selection change or the next open attempt. Mounting the same selected Item after the opening checkpoint does not silently change policy.

## Projection defaults

- Base Select Content: `position` would default to `'popper'` for backward compatibility.
- Shadcn Select Content: preserve its cataloged `position='item-aligned'` parameter default; completed behavior remains a gap until authorized and implemented.
- Brutalist Select Content: inherits Base `'popper'` behavior because its current draft entity authorizes only visual/style deltas.

## Implementation ordering

`PropsKernel.setDefaults()` is latest-first. If Base begins registering `popper` inside `asSelectContent()`, Shadcn must reapply its `item-aligned` default after calling `asSelectContent()`. A no-prop regression test must prove that the cataloged Shadcn default survives inherited setup.

## Scroll-before-measure

With `overflow-y-auto` and the current `preventScroll: true` focus path, an offscreen selected item remains clipped. On first open, Shadcn's scrollport is not authoritative until the positioning size policy has written `--proto-ui-available-height` and the corresponding `max-height` constraint has taken effect. The host must therefore keep Content hidden, run the sizing pass, evaluate target visibility against that constrained scrollport, scroll the target when necessary, then remeasure and place; checking visibility against the unconstrained list is invalid. The same ordered pipeline applies to an explicit selection rebind, or it falls back to popper positioning if sizing, scrolling, or remeasurement cannot complete. After reveal, user-driven scrolling within the list must neither restore the originally selected row nor move the floating root to chase it; scroll-triggered generic updates preserve the revealed placement and do not invoke descendant alignment again.

## Observation and transition completion

The active descendant-alignment lease must observe the selected target in addition to the anchor and floating root. A bounded host-owned element-size observer requests recomputation when the selected row changes size while Content remains open. It must be paired with an epoch-bounded layout-shift observation that detects a preceding sibling resizing and moving an unchanged selected row without treating ordinary Content-scroll movement as a request to re-scroll or realign. Rebinding the selected target or ending the Content view epoch must dispose both observers; animation-frame polling remains forbidden.

Shadcn's `zoom-in-95` changes rendered rectangles without triggering the existing ResizeObserver update. The entry recipe and semantic Transition must share both the reveal boundary and one reduced-motion decision. Before the current attempt's reveal commit, the visual surface must not apply `animate-in` / `zoom-in-95`, and the semantic enter-duration clock must not elapse behind the hidden barrier. The reveal commit makes Content visible and arms the CSS animation and semantic enter clock together, so a slow first positioning computation cannot truncate or entirely consume the cataloged transition before the first visible frame. Under `prefers-reduced-motion: reduce`, the transform animation is omitted and the semantic boundary completes immediately from reveal. With motion enabled, final recomputation is keyed to the open-attempt-scoped visual surface's own filtered `animationend`/`transitionend` completion, not merely the semantic duration timer. The completion handler requests one final positioning update using then-current host geometry and revalidates the open-attempt and view generations before publishing; it is disposed on close, attempt replacement, or view-epoch replacement. This signal carries no geometry through prototype state and does not authorize per-frame polling.

## Catalog impact before implementation

The present catalog only governs anchor/floating placement. A maintainer checkpoint must choose and catalog one of these shapes before implementation:

- extend the draft `C-ANCHORED-POSITIONING-0001`, `HC-ANCHORED-POSITION-0001`, and `M-POSITIONING-0001` with an optional epoch-bounded descendant-target policy, privileged target resolution, scroll/measurement order, selected-target observation, collision fallback, and cleanup; or

The catalog checkpoint must also include `C-AS-OVERLAY-0001-M/N` and `T-AS-OVERLAY-0001` for Overlay's privileged `PartView` registration, Anatomy target resolution, and lease orchestration; omitting those revisions would leave the selected-target channel's owner boundary stale.
- introduce a parallel contract, host capability, and module policy and relate them explicitly to the existing anchored lease.

Either choice also requires consistent revisions to `P-BASE-SELECT-CONTENT`, `P-SHADCN-SELECT-CONTENT`, their mapped test entities, and the relevant positioning test entity. `P-BASE-SELECT-CONTENT-DEFERRED-SURFACES` remains authoritative until that checkpoint; this record alone does not remove item-aligned positioning from the deferred surface.

The combined selection transaction is also outside the admitted Content-only surface. Before it can replace the current separate Item `requestValue` / `requestOpen` sequence, the checkpoint must revise `P-BASE-SELECT` Root request arbitration and `P-BASE-SELECT-ITEM` commit semantics together with their mapped `T-BASE-SELECT-0001` and `T-BASE-SELECT-ITEM-0001` cases. Until then, their current request and commit criteria remain authoritative; this proposal does not silently reinterpret them as an atomic transaction.

The proposed `partsReady` boundary is also new catalog surface. The checkpoint must either refine `C-HOST-VIEW-ATTACHMENT-0001` / `C-LIFECYCLE-0008` and their mapped tests to own descendant-registration readiness, or introduce a dedicated readiness contract and host capability related to those lifecycle entities. In either case, the affected `A-WEB-COMPONENT-0001`, `A-REACT-18-19-0001`, `A-VUE-3-0001`, and `A-VUE-2-0001` profiles and cross-adapter mappings must explicitly project the same first-post-render readiness and provisional-visibility rule. It cannot remain an uncataloged adapter callback hidden inside this proposal.

Reveal-gating the semantic enter-duration clock changes the fallback-completion timing currently governed by draft `C-AS-TRANSITION-0001-G` / `C-AS-TRANSITION-0001-N` and `P-BASE-TRANSITION-FALLBACK-COMPLETION`. The checkpoint must revise those Transition criteria and the mapped `T-AS-TRANSITION-0001` / `T-BASE-TRANSITION-0001` evidence, or choose a different positioning-owned design that does not alter Transition timing. This record alone does not override the current Transition contract or add an uncataloged completion-control surface.

## Evidence needed

- Catalog revisions or new parallel entities for the positioning contract, host capability, module policy, Select prototypes, and their executable test mappings.

Overlay evidence must cover privileged registration, target resolution, lease replacement, and cleanup together with the positioning tests; the checkpoint cannot claim selected-target coverage from Positioning and Select evidence alone.
- Module and host tests for semantic identity to opaque target binding; target-generation cancellation and per-request computation sequencing with deliberately out-of-order `computePosition()` completions both across replacement and for one unchanged target; target replacement and view-epoch cleanup; hidden sizing before scrollport visibility checks; post-scroll remeasurement before alignment; opening/rebind-only forced scrolling; user scrolling after reveal without selected-row restoration or floating-root movement; selected-target size and non-scroll layout-shift observation; placement/collision fallback; capability-absent terminal reveal and popper-only host fallback; and final recomputation after reveal-started visual completion in both normal and reduced-motion modes.
- Select and adapter tests for the per-`(open attempt, view epoch)` first-post-render `partsReady` boundary; the existing React StrictMode layout-effect detach/reattach replay path issuing replacement-epoch readiness without recreating the Proto instance; close/reopen leave reversal on one retained view and lease without stale readiness or computation publication; hidden/non-interactive first-mount provisional Content; entry focus and entry animation deferred until the reveal commit even when positioning is delayed; graceful visible/interactable fallback when positioning cannot attach; sticky popper fallback for empty/unmatched/late-mounted same-selection targets; open-preserving selection rebind; a combined Item-to-Root commit case mapped through both `T-BASE-SELECT-0001` and `T-BASE-SELECT-ITEM-0001`; `closeOnSelect=true` selection without exit-time rebind, forced scroll, or placement movement; Shadcn's no-prop `item-aligned` default after inherited setup; and Base/Brutalist popper defaults.
- Transition tests mapped through `T-AS-TRANSITION-0001` and `T-BASE-TRANSITION-0001` for delayed reveal starting the enter fallback clock, visual completion cancelling that fallback, stale attempt/epoch completion rejection, and reduced-motion ordering from the reveal boundary.
- Browser tests verifying final-frame visual alignment and fallback separately across Web Component, React, Vue 3, and the active Vue 2 adapter, including a first-open long list whose far-down selected Item appears visible before `max-height` but requires scrolling after the hidden sizing pass, a selected row whose own height changes, and a preceding sibling whose height changes while the selected row remains unchanged.

## Status

This is an unauthorized proposal. Implementation requires a maintainer checkpoint to admit the `position` prop to Base Select Content, choose the catalog shape for descendant-alignment positioning, and authorize the corresponding draft entity revisions and executable evidence. Until then, Base and Brutalist retain popper behavior and Shadcn's `position='item-aligned'` remains only the already-cataloged parameter/default gap rather than a completed behavior guarantee.
