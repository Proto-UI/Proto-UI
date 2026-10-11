# Experimental normalized axis input

This Finf development slice converts a bounded Move Gesture into dimensionless logical input. It is WIP pending independent consumer/catalog admission, not a stable Move, Drag and Drop, native, or compiler guarantee.

Use `asAxisInput()` on the anatomy input part. During setup, call `configure({ anatomy, inputRole, geometryRole })` and `on((run, sample) => ...)`. During a lifecycle/props callback, call `sync({ axis, direction, disabled, readOnly, reverse })`. It starts disabled until explicitly enabled. The geometry part is either the input itself or its nearest same-family ancestor, never an unrelated matching role.

Samples contain only `phase`, normalized `position` in `[0, 1]`, and signed `delta`/`totalDelta` fractions of the geometry span captured at start. Deltas are not clamped; a contact can travel farther than one span. Horizontal RTL reverses the logical direction; vertical increases downwards. `reverse` adds an independent reversal. Cancellation contains only `phase: 'cancel'` and `reason`.

The domain consumer owns quantization, value limits, resize limits, carousel thresholds, commit/rollback and accessibility. Keyboard input should call the same logical requests. No DOM objects, contacts, timestamps or pixel measurements enter Props, State or ProtoEventPayload.

The Web host reuses Move Gesture, validates nonzero finite geometry, observes geometry detach, rejects disabled/read-only input, and cancels on replacement or changed configuration. A fixed start-time span prevents resizing a root during dragging from changing the delta unit. Missing host capability stays inert. React, Vue, Vue2 and Web Component adapters are wired; synthetic geometry integration tests exercise their actual runtime callback path. Native, GPUI, Flutter and compiler input providers are not implemented here.
