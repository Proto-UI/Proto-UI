# Switch constrained drag-to-value implementation design

Non-normative record. Refs #498. This is an unauthorized proposal — #498 has no substrate/carrier checkpoint. Does not create a stable spec guarantee or authorize merge.

## Substrate proposal

The Move substrate (C-MOVE-GESTURE-0001) is immediate-only. The proposed approach is immediate Move with commit-on-release semantic. This is a design recommendation, not an authorized decision — a maintainer checkpoint must choose between immediate Move and a threshold extension before implementation.

## Carrier admission gap

Move is currently wired only through `SCROLL_SURFACE_HOST_CAP`. Switch Root has no admitted `MoveGestureHost`/asHook carrier. `D-MOVE-GESTURE-0001-B` forbids reconstructing Move from prototype pointer events. The carrier must be admitted and wired before directing Switch implementation to consume Move.

## Proposed implementation (subject to checkpoint)

### 1. Immediate Move session on root pointerdown

The root starts a Move session on pointerdown (the root owns the gesture, not the thumb per P-BASE-SWITCH-THUMB-NOT-TARGET). If |deltaX| exceeds the threshold, store a candidate value (not checked) for commit on release.

### 2. Tap/click arbitration

On Move session end:

- If the session committed a drag value: suppress the next **pointer-generated** `press.commit` only — correlate the suppression to the drag session's pointer identity (pointerId), not a generic one-shot flag. This prevents an unrelated keyboard Space/Enter activation during the suppression window from being swallowed.
- If below threshold: allow `press.commit` to proceed normally
- The suppression is cleared when the drag's pointer release event is received (the click that the browser synthesizes from the same pointer session), or on next pointerdown, or after a bounded timeout (e.g., 300ms) only as a safety net for edge cases where the synthesized click never arrives (e.g., host swallowed it). The timeout does not gate keyboard activation — a keyboard `press.commit` during the window proceeds normally because it has a different pointer identity (none).

### 3. Focus preservation

Immediate Move calls `preventDefault()` on accepted pointerdown, while current Switch `pointer.down` does not focus itself. The design must add a focus-preservation path (call `focusSelf()` before starting the Move session, or choose a substrate that preserves native focus). Browser evidence must verify focus is retained.

### 4. Provisional progress channel

During drag, the root must project continuous progress to the thumb. Per C-CONTEXT-0009-D and P-BASE-SWITCH-CONTEXT-VALUE, State handles are prohibited in context values. Use JSON-compatible snapshots (`number | null`) for `dragProgress` in SWITCH_CONTEXT, not State handles. **Note:** Extending SWITCH_CONTEXT with a new carrier is a cross-adapter projection/ownership decision that requires a separate maintainer checkpoint.

### 4. Disabled handling

Per P-BASE-SWITCH-DISABLED-SUPPRESS-ACTIVATION and P-BASE-SWITCH-DISABLED-CLEAR-TRANSIENT:

- Disabled root rejects Move session start on pointerdown
- Mid-session disable cancels the Move session and clears the candidate value
- Cleanup removes the suppression flag and dragProgress

### 5. Cancel handling

All Move cancel reasons (host-cancel, lost-ownership, target-detached, target-replaced, disposed) result in: (1) no value change — candidate discarded, (2) `dragProgress` reset to `null` so the thumb returns to checked truth, (3) suppression flag cleared.

### 6. Existing click behavior preserved

Small movements below threshold + release trigger the existing `press.commit` path (toggle checked).

## Evidence needed

- New criterion in P-BASE-SWITCH for drag-to-value behavior
- Implementation in Switch root prototype using admitted Move carrier
- Test case verifying threshold commit, cancel no-op, disabled rejection
- Browser test verifying thumb-follows-finger in WC/React/Vue

## Status

This is an unauthorized proposal. Implementation requires:

1. A maintainer checkpoint choosing immediate Move vs threshold extension
2. Admission of a Move carrier for Switch Root
3. Admission of a dragProgress carrier in SWITCH_CONTEXT
4. Spec admission of drag-to-value behavior in P-BASE-SWITCH
