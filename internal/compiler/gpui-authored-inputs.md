# Authored inputs in generated GPUI controls

This private Compiler slice implements generic operations reached by native controls. `C-A11Y-0001`, `C-EVENT-TYPE-0002`, `C-TEXT-CONTROL-0001` and `C-COMPILER-SCALAR-INPUT-0001` are the definitions. Their draft lifecycle is unchanged. No component name, source path or application policy participates in lowering.

## Accessibility

`activate` projects to AccessKit Click. A declaration whose event names an Expose signal enters the ordinary `press.commit` input route; the authored callback checks disabled or selection policy and emits that signal itself. An explicit `host:*` event preserves its requested input route, including controls whose assistive action does not mean an ordinary press. The native bridge never emits an outward event as input. Pointer clicks and context-menu input retain their modifier facts; assistive activation does not invent pointer facts.

`accessible.state(key, value, { when })` retains two State handles. Declaration checks the Boolean condition before recording it and rechecks final setup. The native AccessKit projection reads value first, then applies the condition; only true projects a fact. Invalid runtime conditions omit the fact without changing the source. Last declaration replaces both value and condition. Node rebuilding withdraws only the generated fact and preserves independent host output. Other standalone source backends reject the conditional argument explicitly; the Runtime-backed profile uses the existing Module implementation.

## Text ownership

The existing public `textControl.resetValue(value?)` is lowered to a bounded editing-lease replacement. Uncontrolled text accepts a canonical supplied value or its retained default. Controlled text keeps owner truth and returns false. Both retire composition, stale callbacks, delayed restoration and undo history. Neither path emits a synthetic input/change proposal. Detach rejects reset; disposed capabilities keep their normal lifetime error.

Native `text_select_utf16(owner, start, end, window, app)` is a host API, not a new portable author hook. A prototype can publish its selected range policy and the host applies it to the exact current editor. It clamps and snaps codepoint boundaries without splitting surrogate pairs, reveals the caret, permits readonly selection, and rejects disabled, composing, detached or foreign-window targets. Consumers must also retain their authored request/view epoch for asynchronous requests; this synchronous host API does not authenticate a stale app task.

While composition is active, ordinary native editing commands cannot navigate, delete, paste, undo or confirm provisional text. The native IME replacement path continues to own that session. Focus traversal also avoids moving away through an unhandled Tab during composition. These tests use GPUI's input handler and are not a claim that a particular OS input method has been exercised.

## Source prerequisites

The shared source and independent IR checks admit UTF-16 string length, checked scalar Number/String conversion, and numeric Math.floor/Math.round. GPUI's rounding preserves ties toward positive infinity and negative zero rather than using Rust's different round behavior. A readonly finite record can form an outward JSON snapshot without gaining lexical write authority or hiding a capability. The shared closed-call provenance analysis retains actual ordinary fields through structural views, aliases, helper arguments/results, arrays and later writes. At an outward event it rejects hidden non-JSON fields, including enumerable undefined, and unresolved structured provenance. A local readonly view remains legal, and an explicitly fresh record can select proven data fields. Absent optional fields remain distinct from present fields containing undefined. Terminal cancellation branches cannot invalidate the distinct continuing branch's lexical refinement; reachable branch effects remain joined.

An authored capture's `render` member retains the callable returned by that exact hook setup. The native lowering follows that nominal provenance to admit scalar or empty render callbacks as well as native renderer callbacks. An absent optional captured renderer keeps the normal default-slot behavior. This does not make arbitrary record members into renderers or add a template interpreter.

For spread and admitted Object.assign, an absent source field preserves the
previous target property on that branch. It cannot erase an earlier enumerable
undefined merely because another branch supplies a safe value.

## Callback delivery and terminal cleanup

A valid Expose emission wakes the native component's observers even when the callback does not modify State or call `run.update()`. The event remains queued until its consumer takes it; observing it does not manufacture a new authored input or duplicate the payload. Invalid emissions cannot schedule a wakeup.

Native focus and blur callbacks run in GPUI's drawing turn, where immediate
`Context::notify` does not dispatch entity-observer effects. Generated component
drivers keep their authored state changes synchronous and defer the entity
notification through a weak view until the current host turn ends. Consumers
therefore receive focus-triggered cancellations and exposed output without
polling or implementing a second blur policy. The real generated focus fixture
checks both the source fact and the external entity observer after focus gain
and loss; the weak notification cannot retain a removed component.
Rendering the generated view does not consume that pending observer signal.
The native parent may call an exposed method while constructing its layout;
the child's subsequent render must preserve event-only output until the queued
driver notifies its consumer. A separate native fixture verifies exactly-once
delivery over repeated native-parent renders without adding authored State or
calling `run.update()`.

Retained callback handles preserve reference identity within their instance, including when a callback compares a saved handle with its own local copy. Handles from different instances remain distinct; the same instance's definition, callback and renderer handles also have separate identities. Equality only observes the reference; it neither grants callback scope nor revives a disposed owner.

`C-LIFECYCLE-0005-E` retains a callback scope for `onBeforeDispose`. Releasing a focus scope in that terminal callback is allowed so its activation and physical entry cannot outlive the owner. This is a release-only path: setup and render remain invalid, disposed owners cannot be revived, and the guard against acquiring new runtime work during disposal is unchanged.

## Executable evidence

`packages/compiler/test/fixtures/gpui-a11y-value/produce.mjs` generates ordinary Rust components directly from the authored numeric, activation, host-activation and text sources. The consumer checks production AccessKit projection, real component callbacks, disabled policy, conditional facts, reset ownership, Unicode length and scalar results. The generated SDK library tests exercise IME leases, stale input, UTF-16 selection and malformed condition boundaries. The event-only native fixture observes two repeated physical activations without an authored State write. The official ControlLabel fixture additionally compiles a consumer that borrows the complete Base Input renderer, mounts its native editor, and resets its value. Generated Rust must not be patched.

Run the producer with a fresh absolute directory, then `cargo metadata` once to admit the exact generated package names into the seed lock. Run the consumer with `cargo test --locked --test a11y_value` and the SDK with `cargo test --locked -p proto-ui-gpui-native --features test-support --lib`. The producer accepts an exact compatible GPUI git/revision and seed lock for a host workspace. Preserve its receipt and record actual native execution separately; compiler acceptance alone is not a native or OS test result.
