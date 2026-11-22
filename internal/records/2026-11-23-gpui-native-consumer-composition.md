# GPUI native consumer composition corrections

The actual native consumer run exposed two host/lowering faults that were not visible from source acceptance alone. A derived Input returned its captured scalar renderer but the GPUI entry only discovered direct scalar callables. Separately, an Expose event without a State change stayed queued because the generated component did not notify its native observer. Neither fault requires changing the authored control's semantics.

The lowering now follows the checked nominal capture back to its exact hook setup result. It preserves ordinary callable values and only adapts them at the native renderer boundary. The Expose bridge marks a successfully queued event as observable work. Real generated-component fixtures cover a derived official Input and repeated physical press events with no authored State update.

Consumer disposal also exercised `focusScope.deactivate()` from `onBeforeDispose`. The lifecycle callback contract retains its cleanup scope; the native bridge now permits this release operation while retaining setup, render, disposed-owner and runtime-acquisition guards.

Two fixture issues are corrected independently of production semantics. The ControlLabel foreign-window case draws outside a root-entity update to avoid double leasing the same GPUI entity. Native key-policy tests construct stable `Keystroke` inputs instead of relying on a closed `KeyDownEvent` field set, which differs between the pinned upstream GPUI and a compatible host fork. The focused native tests remain necessary evidence; generating Rust or passing TypeScript checks is not treated as native execution.
