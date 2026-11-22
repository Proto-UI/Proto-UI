# GPUI native consumer composition corrections

The actual native consumer run exposed two host/lowering faults that were not visible from source acceptance alone. A derived Input returned its captured scalar renderer but the GPUI entry only discovered direct scalar callables. Separately, an Expose event without a State change stayed queued because the generated component did not notify its native observer. Neither fault requires changing the authored control's semantics.

The lowering now follows the checked nominal capture back to its exact hook setup result. It preserves ordinary callable values and only adapts them at the native renderer boundary. The Expose bridge marks a successfully queued event as observable work. Real generated-component fixtures cover a derived official Input and repeated physical press events with no authored State update.

Consumer disposal also exercised `focusScope.deactivate()` from `onBeforeDispose`. The lifecycle callback contract retains its cleanup scope; the native bridge now permits this release operation while retaining setup, render, disposed-owner and runtime-acquisition guards.

Two fixture issues are corrected independently of production semantics. The ControlLabel foreign-window case draws outside a root-entity update to avoid double leasing the same GPUI entity. Native key-policy tests construct stable `Keystroke` inputs instead of relying on a closed `KeyDownEvent` field set, which differs between the pinned upstream GPUI and a compatible host fork. The focused native tests remain necessary evidence; generating Rust or passing TypeScript checks is not treated as native execution.

## Follow-up from the compiled official Input

The `231be0e8d` native run passed the new renderer boundary but the official Input's `resetValue` returned false. Its own lifecycle guard compared a retained RunHandle with a local copy of that same reference. The GPUI value equality implementation omitted the owner-capability case, making the equal references compare unequal. Equality now uses the existing owner reference identity; different instances remain unequal and disposed callback operations still fail. The original native Input assertion remains unchanged, with an additional SDK regression for identity and retirement. This observation is separate from the renderer correction and does not weaken the prototype's reentry checks.

A follow-up negative source check also admitted comparison between definition and callback handles. Those handles, and the renderer handle, need separate identities even within one instance. The native values now distinguish the three kinds at their real entry points instead of banning the legal comparison or using one owner identity for every kind. The official derived Input fixture compares its retained callback handle both with a local copy and with the definition handle.

## Follow-up from actual physical view reuse

At `8eccebec7`, actual native input consumers passed 14/14 and SDK tests passed 17/17. The official ControlLabel/Input consumer passed 7/8: the repaired Input reset succeeded, but a real pointer down survived an ambiguous frame and activated after the unique view was restored. The exact-node receipt was only observed through logical projection commit. GPUI could reuse an already committed authored projection while laying it out through another native parent, so the physical transition never advanced that receipt. The native prepaint boundary now also observes it after layout has collected all occurrences. The original failing native assertion is retained; the tuple still excludes frame serials, so stable layouts do not produce repeated invalidations.

The subsequent `e2ee4ca20` native ControlLabel run passed 8/8, including that
unchanged previously failing physical-reuse assertion.

## Independent review and actual consumer follow-up

Independent review found three additional bounded gaps. A structurally narrowed
readonly view could hide enumerable undefined from the outward JSON type check.
The shared source and independent IR callable-provenance walk now retains actual
ordinary records, arrays, aliases, helper arguments/results and relevant mutable
stores at JSON event sinks. It distinguishes absent fields from own undefined
properties and leaves local-only views and explicit fresh data copies legal.
Scalar stores retain their finite abstraction, and graphs with no JSON event
output do not acquire the extra ordinary-data analysis.

An actionable Base Label did not request window activation observation because
it intentionally has no focus/press ownership. Its window observation demand is
now separate from focus and Tab participation. A real native inactive/active
pointer regression retains the old request across a window switch and requires
it to be refused. Scroll axis sync also now gates automatic end-follow on the
currently allowed axis, consumes disabled-interval growth, and preserves the
authored policy. A physical nonzero-overflow regression checks rejection,
suspension, re-enabling without replay, and subsequent fresh growth.

Actual application execution established that focus/blur source state had
already changed while its consumer observer had not been notified. GPUI omits
entity-observer effects during its drawing phase. Generated drivers now publish
their notification through a weak deferred view, and rendering cannot consume
the driver's pending dirty signal. Real native focus and parent-Render event-only
fixtures cover both paths. An attached native MoveGesture also requests pointer
ownership without requiring the authored control to declare Trigger; the nested
native fixture checks that its accepted gesture does not activate the parent.

At this local follow-up checkpoint, 199 focused compiler tests passed, the
bounded compiler TypeScript check passed, and the three edited spec entities
validated against the schema. All 14 Verdant source units compiled successfully.
Fresh ordinary-value (30 modules), official ControlLabel and accessibility
consumer producers succeeded without editing generated Rust. The new native
fixtures, whole compiler suite and final consumer regeneration remain pending
on the separate native build machine; these generation receipts do not assert
their execution or stable platform accessibility acceptance.
