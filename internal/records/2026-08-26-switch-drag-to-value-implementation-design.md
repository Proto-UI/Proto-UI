# Switch constrained drag-to-value implementation design

Non-normative record. Refs #498. This is an unauthorized design proposal. It does not amend `spec/**`, create a stable guarantee, admit a carrier, or authorize implementation or merge.

## Authority and unresolved substrate gate

The current draft Move substrate supports only immediate primary-contact sessions. `D-MOVE-GESTURE-0001-C` does not admit threshold recognition or press arbitration as a stable guarantee, and `HC-MOVE-GESTURE-0001-C` keeps coordinate units, contact identity, capture, and default-action mechanics outside prototype-author code. The adapters currently provide `createWebMoveGestureHost()` only inside `SCROLL_SURFACE_HOST_CAP`; Switch Root has no Move carrier.

Issue #498 still has an explicit A/B semantic gate:

- A: extend immediate Move with host-owned directional/tap arbitration suitable for Switch; or
- B: admit a pending/threshold recognition extension across the Move decision, contract, host capability, and tests.

This record explores the required behavior if a Switch policy is admitted. It does not select A or B. The current Web Move host, unchanged, is insufficient because it prevents default, captures immediately, sets `touch-action: none`, exposes local samples to its internal consumer, and provides no correlated click-suppression operation.

## Candidate host policy — not an existing API

Switch Root must remain the gesture/value owner and the Thumb must remain an eventless, presentational indicator. A future internal Switch-value gesture carrier would bind the Root target to a host policy. Exact names are illustrative only; no `asMove()`, public drag API, or existing `MoveGestureHostBinding` extension is claimed here.

The host policy owns:

- target resolution and the entire contact/session identity;
- track measurement, writing direction, local coordinate system, and normalized endpoint mapping;
- activation threshold and horizontal-versus-vertical intent arbitration;
- pointer capture or platform arena ownership and default-action policy;
- correlation and suppression of a drag-generated click; and
- bounded cleanup on end, cancel, replacement, detach, disable, and disposal.

The Root-facing callbacks receive only host-neutral facts:

- `progress: number` clamped to `[0, 1]`;
- `candidateChecked: boolean`, derived by the host from the normalized endpoint rule;
- `activated: boolean`; and
- terminal `end` or governed cancel reason.

Root never inspects `deltaX`, pixels, pointer/contact identity, DOM rectangles, capture state, or native click identity. The existing `MoveGestureSample` remains host-local input to the admitted policy rather than prototype-author data.

## Deterministic progress and endpoint mapping

The host maps the contact onto the usable inline travel of the Root track and normalizes it to `[0, 1]`. It resolves writing direction locally so that progress `0` means the semantic unchecked endpoint and progress `1` means the semantic checked endpoint, independent of physical left/right direction. The boundary rule is deterministic:

- `progress < 0.5` produces `candidateChecked=false`;
- `progress >= 0.5` produces `candidateChecked=true`.

Activation is a separate host-owned recognition result. The threshold may use host-local distance/intent evidence, but the Root sees only `activated`; no threshold pixels or local deltas enter Props, State, Context, or Expose. Velocity, overshoot, and multi-recognizer competition remain out of scope unless separately admitted.

## Vertical scrolling and focus preservation

The admitted Web policy must preserve vertical page scrolling over a Switch. It may use a pending horizontal recognizer, `touch-action: pan-y` plus bounded directional arbitration, or another governed host strategy, but it must not reuse the current unconditional `touch-action: none` and immediate prevention behavior unchanged. A vertical-dominant touch must remain available to the page and must produce no Switch value request.

Accepting a horizontal session must also preserve normal pointer focus. The Root focus target is focused before default behavior is suppressed, or the host policy supplies an equivalent focus-preserving path. Thumb never becomes a focus or Move target.

## Root-owned provisional presentation

During an active horizontal drag, Root owns a provisional `dragProgress: number | null` display fact. If the admitted carrier uses `SWITCH_CONTEXT`, it publishes only the JSON-compatible number or field-level `null` allowed by `C-CONTEXT-0009`; it never publishes a State handle, host object, Map, function, or pointer data. Thumb derives paint from that observable Context snapshot while continuing to derive persistent `checked` truth from Root.

Adding this Context field and the corresponding Thumb projection is not an existing capability. It requires Switch/Thumb entity, type, implementation, and test admission. It gives Thumb no activation or value ownership: `dragProgress` is ephemeral presentation, while `checked` remains the sole persistent value truth.

## Session flow and cleanup

### Start and move

- Disabled Root rejects session start in the host `shouldStart`/policy gate.
- Root retains the existing pressed visual and focus responsibility.
- Host policy publishes neutral progress/candidate updates only after it owns the horizontal session.
- Movement updates provisional progress only; it never mutates `checked` and never emits `checkedChange`.

### Normal end

The Root first snapshots `activated` and `candidateChecked`, then clears `dragProgress` to `null`, clears the candidate, and resets `pressed=false` on every normal end.

- Activated drag: submit exactly one request through the existing controlled/uncontrolled Switch value path using `candidateChecked`; do not route the terminal action through `press.commit`, whose toggle semantics would ignore the selected endpoint.
- Below-threshold/tap end: submit no drag request and allow the correlated native click to reach the existing `press.commit` toggle path.

Clearing progress before the request ensures a controlled owner that rejects or delays `checkedChange` immediately paints the current owner-provided `checked` truth rather than a released provisional position.

### Cancel and disable

Every Move cancellation reason, vertical-intent rejection, mid-session disable, target replacement, detach, and disposal performs the same bounded cleanup:

- emit no value request;
- discard the candidate;
- set `dragProgress=null`;
- reset Root `pressed=false`; and
- cancel any unconsumed host click-arbitration record for that session.

Mid-session disable additionally prevents any later callback from reviving the session. Cleanup cannot depend on receiving a prototype `pointer.cancel`, because host ownership loss may bypass that Event route.

## Correlated click arbitration

An activated Web drag may still synthesize a native click after `pointerup`; allowing it through the event router would emit `press.commit` and toggle a second time. Suppression therefore belongs to a separately admitted host-local arbitration seam, not to a Root boolean and not to pointer-ID comparison in prototype code.

For an activated session, the host arms a record associated with that exact native contact/session. `onEnd` runs during pointer release, but the record remains armed after release. It is consumed only by the correlated synthesized click before the event router creates `press.commit`. It is not consumed by keyboard Space/Enter, unrelated pointer clicks, or later Switch instances. If no correlated click arrives because the target is disabled, detached, replaced, or the host suppresses it, the record expires through bounded host cleanup without suppressing a future semantic activation.

Below-threshold taps never arm suppression. Cancellation removes any pending record. The carrier checkpoint must explicitly include this arbitration operation and its integration with the Web event router; admitting only access to `MoveGestureHost` is insufficient.

## Controlled and uncontrolled value ownership

Drag end reuses the existing Switch request semantics with an explicit endpoint rather than toggling:

- uncontrolled Root sets `checked=candidateChecked` and emits one `checkedChange` if the endpoint differs from current truth;
- controlled Root emits the requested endpoint once and does not mutate owner truth;
- if the endpoint equals current truth, submit no request because `checkedChange` represents an actual value change.

Keyboard Space/optional Enter and ordinary clicks remain unchanged. `aria-checked` continues to follow persistent `checked`, never provisional progress.

## Required authority checkpoints

Implementation remains gated on all of the following:

1. maintainer selection of immediate-plus-arbitration versus a pending/threshold Move extension;
2. admission of an internal Switch Root carrier that does not expose host-local samples;
3. admission of directional/default-action policy that preserves vertical touch scrolling and pointer focus;
4. admission of the host-local correlated click-suppression operation and event-router integration;
5. admission of the JSON-compatible provisional progress carrier and Thumb paint projection; and
6. revision of `P-BASE-SWITCH`, `P-BASE-SWITCH-THUMB`, Move/host-cap entities as applicable, and their executable test mappings.

Until these checkpoints are satisfied in `spec/**`, current click-only Switch behavior and current immediate Scroll-owned Move wiring remain the implementation evidence.

## Executable evidence

- Host-policy tests prove Root callbacks never receive local deltas, rectangles, pointer IDs, capture state, or native events; they receive only normalized progress, candidate endpoint, activation, and terminal outcome.
- Boundary tests lock `progress < 0.5 => false` and `progress >= 0.5 => true`, including RTL/inline-direction normalization and variable Root track geometry; adapter paint maps normalized progress without making Thumb a measurement or event target.
- Arbitration tests prove tap yields one `press.commit`, activated drag yields at most one endpoint request, the correlated click is suppressed after pointer release, absent clicks expire safely, and keyboard/unrelated clicks are never suppressed.
- Touch tests prove vertical-dominant movement scrolls the containing page without capture/value change, while horizontal intent activates the Switch policy.
- Focus tests start from an unfocused Switch, accept a horizontal gesture, and verify subsequent Space activation still targets the Switch.
- Lifecycle tests cover all Move cancel reasons, lost capture without prototype `pointer.cancel`, target replacement, detach, disposal, disabled start, and mid-session disable; each clears candidate, progress, pressed state, and arbitration state.
- Controlled tests cover owner accept, reject, and delayed response; progress clears on every normal end before owner response and persistent paint returns to owner truth.
- Browser journeys exercise Web Component, React, Vue 3, and the active Vue 2 adapter separately for continuous thumb progress, endpoint release, cancellation return, vertical scroll preservation, focus, click arbitration, and keyboard invariants.

## Status

This record remains unauthorized and non-normative. It documents the minimum design obligations exposed by review; it does not choose the open substrate branch or claim that any carrier, progress channel, directional recognizer, click-arbitration seam, or drag-to-value behavior exists. Implementation requires the listed authority checkpoints and exact executable evidence before the draft behavior can be presented as a Proto UI guarantee.
