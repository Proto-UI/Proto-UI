# Switch constrained drag-to-value implementation design

Non-normative record. Authorized by #498 maintainer checkpoint. Does not create a stable spec guarantee or authorize merge.

## Substrate decision

The Move substrate (C-MOVE-GESTURE-0001) is immediate-only: pointerdown → accept → preventDefault → capture → start. There is no threshold activation. The Switch must use immediate Move with commit-on-release semantic.

## Proposed implementation

### 1. Immediate Move session on thumb pointerdown

When the user presses the thumb:

1. Immediately start a Move session (no threshold)
2. The Move session provides samples (deltaX/deltaY) to the Switch root
3. If the movement is below a threshold before release, treat as a click (press.commit)

### 2. Drag-to-value mapping

The Switch root maps horizontal movement to a checked/unchecked value:

- Track total deltaX from session start
- If |deltaX| exceeds the threshold (e.g., half the track width), set checked to the direction of movement
- On Move session end (pointerup), commit the final value via `checkedChange`

### 3. Cancel handling

All Move cancel reasons (host-cancel, lost-ownership, target-detached, target-replaced, disposed) result in a no-op: no value change. The Switch keeps its pre-drag checked state.

### 4. Existing click behavior preserved

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
