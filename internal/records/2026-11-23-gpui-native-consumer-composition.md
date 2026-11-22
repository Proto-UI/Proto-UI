# GPUI native consumer composition corrections

The actual native consumer run exposed two host/lowering faults that were not visible from source acceptance alone. A derived Input returned its captured scalar renderer but the GPUI entry only discovered direct scalar callables. Separately, an Expose event without a State change stayed queued because the generated component did not notify its native observer. Neither fault requires changing the authored control's semantics.

The lowering now follows the checked nominal capture back to its exact hook setup result. It preserves ordinary callable values and only adapts them at the native renderer boundary. The Expose bridge marks a successfully queued event as observable work. Real generated-component fixtures cover a derived official Input and repeated physical press events with no authored State update.

Consumer disposal also exercised `focusScope.deactivate()` from `onBeforeDispose`. The lifecycle callback contract retains its cleanup scope; the native bridge now permits this release operation while retaining setup, render, disposed-owner and runtime-acquisition guards.

Two fixture issues are corrected independently of production semantics. The ControlLabel foreign-window case draws outside a root-entity update to avoid double leasing the same GPUI entity. Native key-policy tests construct stable `Keystroke` inputs instead of relying on a closed `KeyDownEvent` field set, which differs between the pinned upstream GPUI and a compatible host fork. The focused native tests remain necessary evidence; generating Rust or passing TypeScript checks is not treated as native execution.

## Follow-up from the compiled official Input

The `231be0e8d` native run passed the new renderer boundary but the official Input's `resetValue` returned false. Its own lifecycle guard compared a retained RunHandle with a local copy of that same reference. The GPUI value equality implementation omitted the owner-capability case, making the equal references compare unequal. Equality now uses the existing owner reference identity; different instances remain unequal and disposed callback operations still fail. The original native Input assertion remains unchanged, with an additional SDK regression for identity and retirement. This observation is separate from the renderer correction and does not weaken the prototype's reentry checks.

A follow-up negative source check also admitted comparison between definition and callback handles. Those handles, and the renderer handle, need separate identities even within one instance. The native values now distinguish the three kinds at their real entry points instead of banning the legal comparison or using one owner identity for every kind. The official derived Input fixture compares its retained callback handle both with a local copy and with the definition handle.
