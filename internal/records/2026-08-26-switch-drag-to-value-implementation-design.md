# Switch constrained drag-to-value implementation design

Non-normative record. Authorized by #498 maintainer checkpoint. Does not create a stable spec guarantee or authorize merge.

## Substrate decision

The Move substrate (C-MOVE-GESTURE-0001) is immediate-only: pointerdown → accept → preventDefault → capture → start. There is no threshold activation. The proposed approach is immediate Move with commit-on-release semantic. This is a design recommendation, not an authorized decision — a maintainer checkpoint must choose between immediate Move and a threshold extension before implementation.

**Authorization status:** The immediate-Move substrate choice is a design recommendation in this record, not an authorized decision. A maintainer checkpoint must confirm the substrate choice before implementation begins. The Base Switch spec admission for drag-to-value behavior is a separate checkpoint that depends on the substrate decision.

## Proposed implementation

### 1. Immediate Move session on thumb pointerdown

When the user presses the Switch root (the thumb is not an independent event target per P-BASE-SWITCH-THUMB-NOT-TARGET):

1. The root starts a Move session on pointerdown (the root owns the gesture, not the thumb)
2. The Move session provides samples (deltaX/deltaY) to the Switch root
3. If the movement is below a threshold before release, treat as a click (press.commit)

### 2. Drag-to-value mapping

The Switch root maps horizontal movement to a checked/unchecked value:

- Track total deltaX from session start
- If |deltaX| exceeds the threshold (e.g., half the track width), store a candidate value (not checked) for commit on release
- On Move session end (pointerup), execute the existing controlled/uncontrolled commit branches once with the candidate value via `checkedChange`. The candidate value is separate from `checked` truth during movement, so cancel can preserve the pre-drag value.

### 3. Tap/click arbitration

The design must define exactly-once tap/click arbitration that preserves a normal click while suppressing the post-drag click. On pointerdown, the root sets an `activated` flag. On Move session end:

- If the session committed a drag value: suppress the next `press.commit` (set a one-shot flag)
- If the session did not commit (below threshold): allow `press.commit` to proceed normally
- The suppression flag is cleared after one `press.commit` or on the next pointerdown

### 4. Click suppression after activated drag

For an activated Web drag, the pointer sequence can still produce a native `click`, and `createWebEventRouter` unconditionally maps routed native clicks to `press.commit`. Without suppression, the Move end would commit the drag value and the follow-up `press.commit` would toggle it again. The design needs an explicit activated-drag flag that suppresses the next `press.commit` when the Move session committed a value.

### 4. Cancel handling

All Move cancel reasons (host-cancel, lost-ownership, target-detached, target-replaced, disposed) result in a no-op: no value change. The Switch keeps its pre-drag checked state.

### 5. Continuous provisional-position channel

During drag before release, the algorithm must project continuous progress to the thumb ("thumb-follows-finger"). The current thumb consumes only the root's boolean `checked` context. A host-local provisional progress/paint channel, separate from checked truth, is needed while the Move session is active. This requires an explicit observable adapter/prototype projection seam: the root must expose a `dragProgress` state handle that the thumb subscribes to through an extended SWITCH_CONTEXT, triggering style reevaluation in WC/React/Vue. **Note:** Extending SWITCH_CONTEXT with a new observable carrier is itself a cross-adapter projection/ownership decision that requires a separate maintainer checkpoint, not an implementation detail already admitted by #498. A non-enumerable property on the root alone cannot reach the thumb (which is a separate prototype subscribing only to SWITCH_CONTEXT) or trigger style reevaluation.

### 7. Existing click behavior preserved

Small movements (< threshold) that end before exceeding the drag threshold trigger the existing `press.commit` path, which toggles checked. This means:

- Click = toggle (existing behavior)
- Drag past threshold = set to drag direction (new behavior)
- Drag below threshold + release = toggle (fallback to click)

### Evidence needed

- New criterion in P-BASE-SWITCH for the drag-to-value behavior
- Implementation in the Switch root prototype using the Move substrate
- Test case verifying threshold commit and cancel no-op
- Browser test verifying thumb-follows-finger in WC/React/Vue

## Open questions

1. What should the drag threshold be? Half the track width? A fixed pixel value?
2. Should vertical drag also work (for vertically-oriented switches)?
3. Should the thumb animate to its final position on release, or snap instantly?

## Status

This is a design record, not an implementation. Implementation requires a maintainer checkpoint to admit the new behavior to the Base Switch spec and confirm the Move substrate decision.
