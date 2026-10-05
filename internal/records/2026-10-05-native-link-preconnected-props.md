# Native-link props before publication

This is a bounded Website owner optimization from `300b4d4c79a13d07909b79c0c9ee05ef8ac2117f` for #777. Draft `P-BASE-SURFACE` and `P-BASE-TEXT` retain passive presentation ownership; the native anchor remains the navigation, focus and selection owner. No Adapter, Base, family recipe, source content, native-content lease, theme batching, scheduling protocol or 1000 ms Search oracle changes.

## Evidence and choice

The ordinary main-CI dark1440 case on application-equivalent merge `66f3963a` missed its original deadline by 28.3 ms. Its source-bound startup observation records a 790 ms task at navigation +1451–2241 ms, Search definition at +2288.8 ms, three staging commands at +2648.6/2656.7/2663.5 ms and atomic activation at +2701.5 ms. That current long task has no function profile and is not wholly attributed to native controls. Historical complete traces do identify document-wide native enhancement before Search definition, but their different app sources and machines do not measure this candidate's benefit.

The current owner source independently exposes redundant work: after connecting fresh Surface/Text atoms it supplies raw props, then always replays the same props through the public setProps method. That method invokes raw-prop synchronization again and requests a controller update. The existing WC bridge explicitly supports pre-connected props through getElementProps/rawPropsSource and bindController; changing the consumer's order needs no new protocol. This is preferred over deferring noncritical enhancement because it removes observed work without moving it beyond the measured startup window.

## Implementation boundary

The existing native-fact bridge supplies the initial facts before composition publication; initial callbacks store facts while the visual binding is not initialized. Fresh public family Surface/Text atoms receive their complete props and closed theme while disconnected, then publish once inside the existing content lease. The same preparation occurs for a real family replacement. A connected atom with its public setter receives one setProps call per necessary update rather than a raw write followed by a repeated raw write.

A missing public setter still receives setElementProps and the previous bounded microtask opportunity. Normal registered atoms expose the setter synchronously on connection and get no replay. Fallback captures exact owner, props revision, binding lifetime and connectivity; newer facts, family replacement or release revoke stale replay. This does not promise support for an arbitrarily delayed custom-element definition: this owner registers its four actual tags before creating them. Test coverage distinguishes the normal first-registration/already-registered routes from an explicit delayed-method-exposure injection on a real WC.

## Discriminating cost observations

The new initial-props suite runs the actual Shadcn/Brutalist atoms, WC Adapter, controller and slot materialization. Pass-through probes retain the real implementations. Counts are deliberately separate:

- setElementProps counts its actual exported implementation entry, including calls originating inside public setProps.
- Public setProps has its own per-instance spy where applicable.
- controller.update counts the real controller's method, not an inferred number of renders.
- mount.render and update.render are actual Runtime lifecycle events.
- Actual CSSStyleDeclaration.setProperty calls are counted for each real atom's --pui-foreground property; this is a selected physical write counter, not all browser style work.
- For the known plain-object surfaceStyle inputs, Object.entries on that exact input is counted as the normalizer's object-enumeration path. No private normalize function is replaced and no claim is made about string/array normalization paths or elapsed cost.

Before the change, each Surface and Text in both first installation and family replacement has two raw-prop calls, two style-object normalization enumerations, two foreground writes, one controller update, one initial mount render and one subsequent update render. The new path has one raw call/normalization/foreground write, zero controller updates/update renders, and still one initial mount render. Initial raw props are complete instead of empty; current decoration/weight and pressed replacement facts reach the first real mount. A later pointerdown retains one public setter/controller update/render while reducing raw calls, normalization and foreground writes from two to one.

All four initial cost/props regressions failed for their intended reason before production changes, then passed. These are deterministic host-unit counts, not a browser timing, GC saving, frame-time measurement or proof that Search now passes.

## Behavioral coverage and limitations

The focused cases cover first initialization and existing registrations, subsequent pressed/current updates, real family replacement with pressed facts, missing-method replay, superseded-fact suppression, family/teardown cancellation, native source identity and focus. Forward/backward selection forwarding uses the established lease-suite workaround for Happy DOM 15's aliased focusOffset getter; an initial test without that workaround failed because of the host fixture limitation. The corrected test explicitly injects only that getter and checks the actual forwarded setBaseAndExtent call. Actual browser directional Selection remains separate evidence.

Existing real-resolver CSSOM/tail, root/theme/media, native navigation and caption/arrow, source lease, Header/four-runtime native-fact and original Search-oracle suites remain part of validation. The local Chromium socket denial is not retried or bypassed. Exact-head hosted native links, first-frame CSSOM and main-CI Search validation remain pending. No milliseconds saved, complete startup fix or new ready-state claim is made.

Co-author by OpenAI Dots

## Independent-review synchronous reentry correction

The first candidate protected delayed replay but not the synchronous target loop. Independent review passed through the real Surface setter, then synchronously published pointerleave from that setter. The nested update correctly cleared hover, but the older outer loop subsequently wrote stale hovered Text props, leaving underline after settlement. The unchanged 300 baseline passed the same comparison.

Three added real-WC regressions were red against the first candidate: new facts and release each allowed an extra stale old-Text raw write, while family replacement allowed an old-Text write after retirement. The target loop now checks the exact owner, props revision and binding lifetime before every synchronous write and stops an invalidated batch immediately. The same predicate also protects the fallback scheduling and replay. Tests retain real controller/setter execution and assert both no stale extra write and the final rendered Text/source ownership; no setter call is replaced with a fake success.

## #816 integration boundary

The child's existing Brutalist brand/nav recipe is a framed navigation Surface, unlike the parent's transparent nav fixture. The imported fresh-family test correctly exposed that semantic difference: pressed was already correct, but expected transparent differed from actual secondary. The child test now explicitly requires its existing secondary/default-radius/all-border/raised inputs on the first real mount, while retaining all exact raw/normalization/style-write/controller/lifecycle counters. The production recipe and its family-aware arguments are unchanged. This is fixture reconciliation, not a conversion of the child to the parent's appearance.
## #815 integration boundary

This child already has the independently owned WC optimization that skips an unchanged nonempty custom-property declaration when live value and priority match. That Adapter implementation remains byte-identical to child HEAD `0a5b6e2f4f3b138b573b4cf2dae4e47e54ca5587`. The imported post-pointerdown fixture expected one physical foreground write and exposed this difference: actual writes are zero, while raw-prop entry, known object normalization and necessary controller update remain one. The child fixture now requires exactly zero equal-foreground writes, exactly one standard min-width write and retained actual foreground; changing the theme then requires exactly one foreground write with the new real value. Initial/fresh-family foreground writes still equal one. The parent's before/after physical-write counts above belong to its Adapter baseline and are not advertised as measured savings on this child.
